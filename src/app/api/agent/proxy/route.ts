import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { agentHarnesses, activityLogs, secrets, projectSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { validateAgentToken } from "@/lib/auth/rbac";
import { decryptData } from "@/lib/crypto";
import { z } from "zod";
import { randomUUID } from "crypto";

// ============================================================================
// Configuration
// ============================================================================

const PROXY_CONFIG = {
  // Rate limiting (requests per minute per agent)
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
  },
  // Request timeout
  timeout: 120000, // 2 minutes
  // Allowed upstream hosts (for firewall)
  allowedHosts: process.env.AGENT_PROXY_ALLOWED_HOSTS?.split(",") || [
    "api.openai.com",
    "api.anthropic.com",
    "generativelanguage.googleapis.com",
    "api.deepseek.com",
  ],
  // Max request body size
  maxBodySize: 10 * 1024 * 1024, // 10 MB
};

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// ============================================================================
// Schemas
// ============================================================================

const ProxyRequestSchema = z.object({
  // Target model provider endpoint
  endpoint: z.string().url("Invalid endpoint URL"),
  // Model provider specific payload
  payload: z.record(z.string(), z.unknown()),
  // Optional: override model
  model: z.string().optional(),
  // Optional: stream response
  stream: z.boolean().default(false),
});

// ============================================================================
// Helper Functions
// ============================================================================

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  return forwarded?.split(",")[0]?.trim() || realIp || "unknown";
}

function checkRateLimit(agentId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = `ratelimit:${agentId}`;
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + PROXY_CONFIG.rateLimit.windowMs,
    });
    return { allowed: true };
  }

  if (record.count >= PROXY_CONFIG.rateLimit.maxRequests) {
    return {
      allowed: false,
      retryAfter: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  record.count++;
  return { allowed: true };
}

function isHostAllowed(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return PROXY_CONFIG.allowedHosts.some(allowed =>
      hostname === allowed || hostname.endsWith("." + allowed)
    );
  } catch {
    return false;
  }
}

async function logProxyActivity(
  agentId: string,
  projectId: string,
  action: string,
  status: "SUCCESS" | "ERROR" | "BLOCKED",
  details: string,
  ipAddress: string
) {
  try {
    await db.insert(activityLogs).values({
      id: randomUUID(),
      projectId,
      userName: "agent",
      userEmail: "agent@system.local",
      action,
      resourceName: agentId,
      environment: "production",
      details,
      ipAddress,
    });
  } catch (error) {
    // Don't fail the request if logging fails
    console.error("Failed to log proxy activity:", error);
  }
}

async function getSecretsForAgent(agentId: string, projectId: string) {
  const agent = await db.query.agentHarnesses.findFirst({
    where: eq(agentHarnesses.id, agentId),
  });

  if (!agent || !agent.allowedSecrets.length) return {};

  const allowedSecrets = await db.query.secrets.findMany({
    where: eq(secrets.projectId, projectId),
  });

  const secretMap: Record<string, string> = {};
  for (const secret of allowedSecrets) {
    if (agent.allowedSecrets.includes(secret.id)) {
      try {
        secretMap[secret.key] = decryptData(secret.value);
      } catch {
        secretMap[secret.key] = "[DECRYPTION_FAILED]";
      }
    }
  }

  return secretMap;
}

function injectSecretsIntoPayload(payload: Record<string, unknown>, secrets: Record<string, string>): Record<string, unknown> {
  const result = { ...payload };

  // Inject secrets into common locations
  if (result.messages && Array.isArray(result.messages)) {
    result.messages = result.messages.map((msg: Record<string, unknown>) => {
      if (msg.content && typeof msg.content === "string") {
        let content = msg.content;
        for (const [key, value] of Object.entries(secrets)) {
          content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
          content = content.replace(new RegExp(`\\$\\{${key}\\}`, "g"), value);
        }
        return { ...msg, content };
      }
      return msg;
    });
  }

  // Inject into top-level fields
  for (const [key, value] of Object.entries(secrets)) {
    if (result[key] === `{{${key}}}` || result[key] === `\${${key}}`) {
      result[key] = value;
    }
  }

  return result;
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const clientIp = getClientIp(request);

  try {
    // -------------------------------------------------------------------------
    // 1. Authentication & Authorization
    // -------------------------------------------------------------------------
    const headerList = await headers();
    const authHeader = headerList.get("authorization") || request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json(
        { error: "Missing authorization header", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Validate agent token
    const agent = await validateAgentToken(authHeader.replace("Bearer ", ""));

    if (!agent) {
      return NextResponse.json(
        { error: "Invalid or expired agent token", code: "INVALID_TOKEN" },
        { status: 401 }
      );
    }

    // Check agent status
    if (agent.status !== "active") {
      return NextResponse.json(
        { error: `Agent is ${agent.status}`, code: "AGENT_INACTIVE" },
        { status: 403 }
      );
    }

    // -------------------------------------------------------------------------
    // 2. Rate Limiting
    // -------------------------------------------------------------------------
    const rateLimit = checkRateLimit(agent.id);
    if (!rateLimit.allowed) {
      await logProxyActivity(
        agent.id,
        agent.projectId,
        "AGENT_PROXY_RATE_LIMITED",
        "BLOCKED",
        `Rate limit exceeded. Retry after ${rateLimit.retryAfter}s`,
        clientIp
      );

      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          code: "RATE_LIMITED",
          retryAfter: rateLimit.retryAfter,
        },
        { status: 429 }
      );
    }

    // -------------------------------------------------------------------------
    // 3. Request Validation
    // -------------------------------------------------------------------------
    let body: z.infer<typeof ProxyRequestSchema>;
    try {
      const rawBody = await request.json();
      body = ProxyRequestSchema.parse(rawBody);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Invalid request body", code: "VALIDATION_ERROR", details: error.format() },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Invalid JSON body", code: "INVALID_JSON" },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------------------
    // 4. Firewall / Host Allowlist Check
    // -------------------------------------------------------------------------
    const projectSettingsRecord = await db.query.projectSettings.findFirst({
      where: eq(projectSettings.projectId, agent.projectId),
    });

    const firewallEnabled = projectSettingsRecord?.enableAgentProxyFirewall ?? true;

    if (firewallEnabled && !isHostAllowed(body.endpoint)) {
      await logProxyActivity(
        agent.id,
        agent.projectId,
        "AGENT_PROXY_BLOCKED",
        "BLOCKED",
        `Blocked request to unauthorized host: ${new URL(body.endpoint).hostname}`,
        clientIp
      );

      return NextResponse.json(
        { error: "Request blocked by firewall: unauthorized host", code: "FIREWALL_BLOCKED" },
        { status: 403 }
      );
    }

    // -------------------------------------------------------------------------
    // 5. Secret Injection
    // -------------------------------------------------------------------------
    let finalPayload = body.payload;

    if (agent.autoMaskSecrets) {
      const agentSecrets = await getSecretsForAgent(agent.id, agent.projectId);
      if (Object.keys(agentSecrets).length > 0) {
        finalPayload = injectSecretsIntoPayload(body.payload, agentSecrets);
      }
    }

    // -------------------------------------------------------------------------
    // 6. Forward Request to Upstream
    // -------------------------------------------------------------------------
    const upstreamHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": `Axiom-Agent-Proxy/${agent.tokenPrefix}`,
    };

    // Forward authorization if it's a known provider
    const endpointHost = new URL(body.endpoint).hostname;
    if (endpointHost.includes("openai.com")) {
      upstreamHeaders["Authorization"] = `Bearer ${process.env.OPENAI_API_KEY}`;
    } else if (endpointHost.includes("anthropic.com")) {
      upstreamHeaders["x-api-key"] = process.env.ANTHROPIC_API_KEY || "";
      upstreamHeaders["anthropic-version"] = "2023-06-01";
    } else if (endpointHost.includes("googleapis.com")) {
      // Google uses API key in URL or Bearer token
      upstreamHeaders["Authorization"] = `Bearer ${process.env.GOOGLE_API_KEY}`;
    } else if (endpointHost.includes("deepseek.com")) {
      upstreamHeaders["Authorization"] = `Bearer ${process.env.DEEPSEEK_API_KEY}`;
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROXY_CONFIG.timeout);

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(body.endpoint, {
        method: "POST",
        headers: upstreamHeaders,
        body: JSON.stringify({
          ...finalPayload,
          ...(body.model && { model: body.model }),
          stream: body.stream,
        }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      const error = fetchError as Error & { name?: string };
      if (error.name === "AbortError") {
        await logProxyActivity(
          agent.id,
          agent.projectId,
          "AGENT_PROXY_TIMEOUT",
          "ERROR",
          `Upstream request timed out after ${PROXY_CONFIG.timeout}ms`,
          clientIp
        );
        return NextResponse.json(
          { error: "Upstream request timeout", code: "TIMEOUT" },
          { status: 504 }
        );
      }

      await logProxyActivity(
        agent.id,
        agent.projectId,
        "AGENT_PROXY_ERROR",
        "ERROR",
        `Upstream fetch failed: ${error.message}`,
        clientIp
      );

      return NextResponse.json(
        { error: "Failed to reach upstream provider", code: "UPSTREAM_ERROR" },
        { status: 502 }
      );
    }

    clearTimeout(timeoutId);

    // -------------------------------------------------------------------------
    // 7. Handle Response
    // -------------------------------------------------------------------------
    const duration = Date.now() - startTime;

    // Update agent token usage
    await db.update(agentHarnesses)
      .set({
        tokensUsedToday: agent.tokensUsedToday + 1,
        lastInvoked: new Date(),
      })
      .where(eq(agentHarnesses.id, agent.id));

    // Log successful proxy
    await logProxyActivity(
      agent.id,
      agent.projectId,
      "AGENT_PROXY_SUCCESS",
      "SUCCESS",
      `Proxied request to ${endpointHost} in ${duration}ms (status: ${upstreamResponse.status})`,
      clientIp
    );

    // Handle streaming response
    if (body.stream && upstreamResponse.body) {
      // Return a ReadableStream for Server-Sent Events
      return new NextResponse(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "X-Axiom-Proxy-Duration": duration.toString(),
          "X-Axiom-Agent-Id": agent.id,
        },
      });
    }

    // Handle non-streaming response
    const responseData = await upstreamResponse.json();

    return NextResponse.json(responseData, {
      status: upstreamResponse.status,
      headers: {
        "X-Axiom-Proxy-Duration": duration.toString(),
        "X-Axiom-Agent-Id": agent.id,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    const err = error as Error;
    console.error("Agent proxy error:", err);

    // Try to log error (best effort)
    try {
      const headerList = await headers();
      const authHeader = headerList.get("authorization") || request.headers.get("authorization");
      if (authHeader) {
        const agent = await validateAgentToken(authHeader.replace("Bearer ", ""));
        if (agent) {
          await logProxyActivity(
            agent.id,
            agent.projectId,
            "AGENT_PROXY_ERROR",
            "ERROR",
            `Proxy error after ${duration}ms: ${err.message}`,
            clientIp
          );
        }
      }
    } catch {
      // Ignore logging errors
    }

    return NextResponse.json(
      { error: "Internal proxy error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// ============================================================================
// Health Check Endpoint
// ============================================================================

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    service: "agent-proxy",
    timestamp: new Date().toISOString(),
    config: {
      rateLimit: PROXY_CONFIG.rateLimit,
      timeout: PROXY_CONFIG.timeout,
      allowedHostsCount: PROXY_CONFIG.allowedHosts.length,
    },
  });
}