import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { activityLogs, agentHarnesses, secrets } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { hashToken, decryptData } from "@/lib/crypto";
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
  // Token usage simulation range
  tokenUsage: {
    min: 150,
    max: 450,
  },
  // Max request body size
  maxBodySize: 10 * 1024 * 1024, // 10 MB
};

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// ============================================================================
// Zod Schemas
// ============================================================================

const ProxyRequestSchema = z.object({
  endpoint: z.string().url("Invalid endpoint URL"),
  payload: z.record(z.string(), z.unknown()),
  model: z.string().optional(),
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

function checkOriginAndReferer(request: NextRequest): { allowed: boolean; reason?: string } {
  const origin = request.headers.get("origin");
  const secFetchSite = request.headers.get("sec-fetch-site");
  const referer = request.headers.get("referer");

  // Allow same-origin requests
  if (secFetchSite === "same-origin") {
    return { allowed: true };
  }

  // Allow same-site requests
  if (secFetchSite === "same-site") {
    return { allowed: true };
  }

  // For cross-origin, check if origin is in allowed list
  // In production, configure this via environment variable
  const allowedOrigins = process.env.AGENT_PROXY_ALLOWED_ORIGINS?.split(",") || [
    "https://claude.ai",
    "https://api.anthropic.com",
    "https://api.openai.com",
  ];

  if (origin && allowedOrigins.some((allowed) => origin.startsWith(allowed))) {
    return { allowed: true };
  }

  // Check referer as fallback
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (allowedOrigins.some((allowed) => refererUrl.origin.startsWith(allowed))) {
        return { allowed: true };
      }
    } catch {
      // Invalid referer URL
    }
  }

  return { allowed: false, reason: "Origin/Sec-Fetch-Site check failed" };
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

function simulateTokenUsage(): number {
  return Math.floor(
    Math.random() * (PROXY_CONFIG.tokenUsage.max - PROXY_CONFIG.tokenUsage.min + 1) +
      PROXY_CONFIG.tokenUsage.min
  );
}

async function logProxyActivity(
  agentId: string,
  projectId: string,
  action: string,
  status: "SUCCESS" | "ERROR" | "BLOCKED" | "RATE_LIMITED" | "EXPIRED" | "REVOKED",
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

async function getAgentSecretMetadata(agentId: string, projectId: string) {
  const agent = await db.query.agentHarnesses.findFirst({
    where: eq(agentHarnesses.id, agentId),
  });

  if (!agent || !agent.allowedSecrets.length) {
    return { count: 0, secrets: [] };
  }

  const allowedSecrets = await db.query.secrets.findMany({
    where: and(
      eq(secrets.projectId, projectId),
      sql`${secrets.id} = ANY(${agent.allowedSecrets})`
    ),
  });

  const secretMetadata = allowedSecrets.map((s) => ({
    id: s.id,
    key: s.key,
    environment: s.environment,
    category: s.category,
    version: s.version,
    isEphemeral: s.isEphemeral,
    expiresAt: s.expiresAt,
    lastRotatedAt: s.lastRotatedAt,
    // Never return plaintext values - only metadata
    valuePreview: "[ENCRYPTED]",
    valueLength: s.value.length,
  }));

  return {
    count: secretMetadata.length,
    secrets: secretMetadata,
  };
}

// Import sql for the IN clause
import { sql } from "drizzle-orm";

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const startTime = Date.now();
  const clientIp = getClientIp(request);
  const { agentId } = await params;

  try {
    // -------------------------------------------------------------------------
    // 1. Cache-Control: no-store
    // -------------------------------------------------------------------------
    const noStoreHeaders = {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    };

    // -------------------------------------------------------------------------
    // 2. Origin / Sec-Fetch-Site Check
    // -------------------------------------------------------------------------
    const originCheck = checkOriginAndReferer(request);
    if (!originCheck.allowed) {
      await logProxyActivity(
        agentId,
        "",
        "AGENT_PROXY_ORIGIN_BLOCKED",
        "BLOCKED",
        `Origin check failed: ${originCheck.reason}`,
        clientIp
      );

      return NextResponse.json(
        { error: "Forbidden: Invalid origin", code: "ORIGIN_BLOCKED" },
        { status: 403, headers: noStoreHeaders }
      );
    }

    // -------------------------------------------------------------------------
    // 3. Authentication: Bearer / x-agent-key Token Hash Verification
    // -------------------------------------------------------------------------
    const headerList = await headers();
    const authHeader =
      headerList.get("authorization") || request.headers.get("authorization");
    const agentKeyHeader =
      headerList.get("x-agent-key") || request.headers.get("x-agent-key");

    let tokenToVerify: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      tokenToVerify = authHeader.slice(7);
    } else if (agentKeyHeader) {
      tokenToVerify = agentKeyHeader;
    }

    if (!tokenToVerify) {
      return NextResponse.json(
        { error: "Missing authorization header (Bearer token or x-agent-key)", code: "UNAUTHORIZED" },
        { status: 401, headers: noStoreHeaders }
      );
    }

    // Verify token hash
    const tokenHash = hashToken(tokenToVerify);
    const agent = await db.query.agentHarnesses.findFirst({
      where: and(
        eq(agentHarnesses.id, agentId),
        eq(agentHarnesses.tokenHash, tokenHash)
      ),
    });

    if (!agent) {
      await logProxyActivity(
        agentId,
        "",
        "AGENT_PROXY_INVALID_TOKEN",
        "ERROR",
        "Invalid or expired agent token",
        clientIp
      );

      return NextResponse.json(
        { error: "Invalid or expired agent token", code: "INVALID_TOKEN" },
        { status: 401, headers: noStoreHeaders }
      );
    }

    // -------------------------------------------------------------------------
    // 4. Status / TTL / Quota Checks
    // -------------------------------------------------------------------------

    // Check agent status
    if (agent.status === "revoked") {
      await logProxyActivity(
        agent.id,
        agent.projectId,
        "AGENT_PROXY_REVOKED",
        "REVOKED",
        "Agent has been revoked (kill switch triggered)",
        clientIp
      );

      return NextResponse.json(
        { error: "Agent has been revoked", code: "AGENT_REVOKED" },
        { status: 403, headers: noStoreHeaders }
      );
    }

    if (agent.status === "sandboxed") {
      await logProxyActivity(
        agent.id,
        agent.projectId,
        "AGENT_PROXY_SANDBOXED",
        "BLOCKED",
        "Agent is in sandboxed mode",
        clientIp
      );

      return NextResponse.json(
        { error: "Agent is sandboxed", code: "AGENT_SANDBOXED" },
        { status: 403, headers: noStoreHeaders }
      );
    }

    if (agent.status === "rate_limited") {
      await logProxyActivity(
        agent.id,
        agent.projectId,
        "AGENT_PROXY_RATE_LIMITED_STATUS",
        "RATE_LIMITED",
        "Agent status is rate_limited",
        clientIp
      );

      return NextResponse.json(
        { error: "Agent is rate limited", code: "AGENT_RATE_LIMITED" },
        { status: 429, headers: noStoreHeaders }
      );
    }

    // Check TTL / expiry
    if (agent.expiresAt && new Date(agent.expiresAt) < new Date()) {
      // Auto-revoke expired harness
      await db
        .update(agentHarnesses)
        .set({ status: "revoked" })
        .where(eq(agentHarnesses.id, agent.id));

      await logProxyActivity(
        agent.id,
        agent.projectId,
        "AGENT_PROXY_EXPIRED",
        "EXPIRED",
        "Agent token expired, auto-revoked",
        clientIp
      );

      return NextResponse.json(
        { error: "Agent token expired", code: "TOKEN_EXPIRED" },
        { status: 401, headers: noStoreHeaders }
      );
    }

    // Check quota (tokens used today vs limit)
    if (agent.tokensUsedToday >= agent.tokenLimitPerHour) {
      // Auto-update status to rate_limited
      await db
        .update(agentHarnesses)
        .set({ status: "rate_limited" })
        .where(eq(agentHarnesses.id, agent.id));

      await logProxyActivity(
        agent.id,
        agent.projectId,
        "AGENT_PROXY_QUOTA_EXCEEDED",
        "RATE_LIMITED",
        `Agent quota exceeded: ${agent.tokensUsedToday}/${agent.tokenLimitPerHour}`,
        clientIp
      );

      return NextResponse.json(
        {
          error: "Agent token quota exceeded",
          code: "QUOTA_EXCEEDED",
          details: {
            used: agent.tokensUsedToday,
            limit: agent.tokenLimitPerHour,
          },
        },
        { status: 429, headers: noStoreHeaders }
      );
    }

    // -------------------------------------------------------------------------
    // 5. Rate Limiting (per-minute)
    // -------------------------------------------------------------------------
    const rateLimit = checkRateLimit(agent.id);
    if (!rateLimit.allowed) {
      await logProxyActivity(
        agent.id,
        agent.projectId,
        "AGENT_PROXY_RATE_LIMITED",
        "RATE_LIMITED",
        `Per-minute rate limit exceeded. Retry after ${rateLimit.retryAfter}s`,
        clientIp
      );

      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          code: "RATE_LIMITED",
          retryAfter: rateLimit.retryAfter,
        },
        { status: 429, headers: noStoreHeaders }
      );
    }

    // -------------------------------------------------------------------------
    // 6. Request Validation
    // -------------------------------------------------------------------------
    let body: z.infer<typeof ProxyRequestSchema>;
    try {
      const rawBody = await request.json();
      body = ProxyRequestSchema.parse(rawBody);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Invalid request body", code: "VALIDATION_ERROR", details: error.format() },
          { status: 400, headers: noStoreHeaders }
        );
      }
      return NextResponse.json(
        { error: "Invalid JSON body", code: "INVALID_JSON" },
        { status: 400, headers: noStoreHeaders }
      );
    }

    // -------------------------------------------------------------------------
    // 7. Server-side Secret Decryption & Count/Masking Metadata Only
    // -------------------------------------------------------------------------
    const secretMetadata = await getAgentSecretMetadata(agent.id, agent.projectId);

    // Note: We decrypt secrets server-side for injection into the upstream request
    // but NEVER return plaintext values in the response - only metadata/count
    let finalPayload = body.payload;

    if (agent.autoMaskSecrets && secretMetadata.count > 0) {
      // Fetch and decrypt allowed secrets for injection
      const allowedSecrets = await db.query.secrets.findMany({
        where: and(
          eq(secrets.projectId, agent.projectId),
          sql`${secrets.id} = ANY(${agent.allowedSecrets})`
        ),
      });

      const secretMap: Record<string, string> = {};
      for (const secret of allowedSecrets) {
        try {
          secretMap[secret.key] = decryptData(secret.value);
        } catch {
          secretMap[secret.key] = "[DECRYPTION_FAILED]";
        }
      }

      // Inject secrets into payload (server-side only)
      finalPayload = injectSecretsIntoPayload(body.payload, secretMap);
    }

    // -------------------------------------------------------------------------
    // 8. Forward Request to Upstream
    // -------------------------------------------------------------------------
    const upstreamHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": `Axiom-Agent-Proxy/${agent.tokenPrefix}`,
    };

    // Forward authorization for known providers
    const endpointHost = new URL(body.endpoint).hostname;
    if (endpointHost.includes("openai.com")) {
      upstreamHeaders["Authorization"] = `Bearer ${process.env.OPENAI_API_KEY}`;
    } else if (endpointHost.includes("anthropic.com")) {
      upstreamHeaders["x-api-key"] = process.env.ANTHROPIC_API_KEY || "";
      upstreamHeaders["anthropic-version"] = "2023-06-01";
    } else if (endpointHost.includes("googleapis.com")) {
      upstreamHeaders["Authorization"] = `Bearer ${process.env.GOOGLE_API_KEY}`;
    } else if (endpointHost.includes("deepseek.com")) {
      upstreamHeaders["Authorization"] = `Bearer ${process.env.DEEPSEEK_API_KEY}`;
    }

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
          { status: 504, headers: noStoreHeaders }
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
        { status: 502, headers: noStoreHeaders }
      );
    }

    clearTimeout(timeoutId);

    // -------------------------------------------------------------------------
    // 9. Update Agent Usage & lastInvoked
    // -------------------------------------------------------------------------
    const simulatedTokens = simulateTokenUsage();
    const newTokensUsed = agent.tokensUsedToday + simulatedTokens;

    // Check if this request pushes us over the limit
    const newStatus = newTokensUsed >= agent.tokenLimitPerHour ? "rate_limited" : agent.status;

    await db
      .update(agentHarnesses)
      .set({
        tokensUsedToday: newTokensUsed,
        lastInvoked: new Date(),
        ...(newStatus !== agent.status && { status: newStatus }),
      })
      .where(eq(agentHarnesses.id, agent.id));

    // -------------------------------------------------------------------------
    // 10. AGENT_ACCESS_GRANTED Audit Logging
    // -------------------------------------------------------------------------
    await logProxyActivity(
      agent.id,
      agent.projectId,
      "AGENT_ACCESS_GRANTED",
      "SUCCESS",
      `Proxied request to ${endpointHost} in ${Date.now() - startTime}ms (status: ${upstreamResponse.status}), tokens: ${simulatedTokens}, quota: ${newTokensUsed}/${agent.tokenLimitPerHour}, secrets: ${secretMetadata.count}`,
      clientIp
    );

    // -------------------------------------------------------------------------
    // 11. Handle Response (never return plaintext secrets)
    // -------------------------------------------------------------------------
    const duration = Date.now() - startTime;

    // Build response with secret metadata only (no plaintext values)
    const responseMeta = {
      agentId: agent.id,
      agentName: agent.name,
      tokenUsage: simulatedTokens,
      quotaUsed: newTokensUsed,
      quotaLimit: agent.tokenLimitPerHour,
      quotaRemaining: Math.max(0, agent.tokenLimitPerHour - newTokensUsed),
      secretCount: secretMetadata.count,
      secrets: secretMetadata.secrets, // Metadata only, no plaintext values
      duration,
      timestamp: new Date().toISOString(),
    };

    // Handle streaming response
    if (body.stream && upstreamResponse.body) {
      return new NextResponse(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: {
          "Content-Type": "text/event-stream",
          Connection: "keep-alive",
          "X-Axiom-Proxy-Duration": duration.toString(),
          "X-Axiom-Agent-Id": agent.id,
          "X-Axiom-Token-Usage": simulatedTokens.toString(),
          "X-Axiom-Quota-Remaining": Math.max(0, agent.tokenLimitPerHour - newTokensUsed).toString(),
          ...noStoreHeaders,
        },
      });
    }

    // Handle non-streaming response
    const responseData = await upstreamResponse.json();

    // Wrap upstream response with our metadata (never exposing secrets)
    const wrappedResponse = {
      ...responseData,
      _axiom: responseMeta,
    };

    return NextResponse.json(wrappedResponse, {
      status: upstreamResponse.status,
      headers: {
        "X-Axiom-Proxy-Duration": duration.toString(),
        "X-Axiom-Agent-Id": agent.id,
        "X-Axiom-Token-Usage": simulatedTokens.toString(),
        "X-Axiom-Quota-Remaining": Math.max(0, agent.tokenLimitPerHour - newTokensUsed).toString(),
        ...noStoreHeaders,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const noStoreHeaders = {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    };

    const err = error as Error;
    console.error("Agent proxy error:", err);

    // Try to log error (best effort)
    try {
      const headerList = await headers();
      const authHeader =
        headerList.get("authorization") || request.headers.get("authorization");
      if (authHeader) {
        const tokenToVerify = authHeader.startsWith("Bearer ")
          ? authHeader.slice(7)
          : authHeader;
        const tokenHash = hashToken(tokenToVerify);
        const agent = await db.query.agentHarnesses.findFirst({
          where: and(eq(agentHarnesses.id, agentId), eq(agentHarnesses.tokenHash, tokenHash)),
        });
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
      { status: 500, headers: noStoreHeaders }
    );
  }
}

// ============================================================================
// Secret Injection Helper
// ============================================================================

function injectSecretsIntoPayload(
  payload: Record<string, unknown>,
  secrets: Record<string, string>
): Record<string, unknown> {
  const result = { ...payload };

  // Inject secrets into messages array (common for LLM APIs)
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
// Health Check Endpoint
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const noStoreHeaders = {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };

  try {
    const agent = await db.query.agentHarnesses.findFirst({
      where: eq(agentHarnesses.id, agentId),
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found", code: "NOT_FOUND" },
        { status: 404, headers: noStoreHeaders }
      );
    }

    // Return health info without sensitive data
    return NextResponse.json(
      {
        status: "healthy",
        agent: {
          id: agent.id,
          name: agent.name,
          status: agent.status,
          environment: agent.environment,
          tokenPrefix: agent.tokenPrefix,
          tokenLastFour: agent.tokenLastFour,
          quotaUsed: agent.tokensUsedToday,
          quotaLimit: agent.tokenLimitPerHour,
          quotaRemaining: Math.max(0, agent.tokenLimitPerHour - agent.tokensUsedToday),
          lastInvoked: agent.lastInvoked,
          expiresAt: agent.expiresAt,
          autoMaskSecrets: agent.autoMaskSecrets,
        },
        config: {
          rateLimit: PROXY_CONFIG.rateLimit,
          timeout: PROXY_CONFIG.timeout,
          tokenUsageRange: PROXY_CONFIG.tokenUsage,
        },
        timestamp: new Date().toISOString(),
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Internal error", code: "INTERNAL_ERROR" },
      { status: 500, headers: noStoreHeaders }
    );
  }
}