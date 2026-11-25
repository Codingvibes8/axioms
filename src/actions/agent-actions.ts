"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { agentHarnesses, activityLogs, secrets, projects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser, authorize } from "@/lib/auth/rbac";
import { hashToken, generateSecureToken, getTokenSuffix } from "@/lib/crypto";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

// ============================================================================
// Schemas
// ============================================================================

const InvokeAgentSchema = z.object({
  agentId: z.string().uuid("Invalid Agent ID format"),
  prompt: z.string().min(1, "Prompt cannot be empty"),
  environment: z.enum(["development", "staging", "production"]).optional(),
});

const CreateAgentSchema = z.object({
  projectId: z.string().uuid("Invalid Project ID format"),
  name: z.string().min(1, "Agent name is required").max(100),
  description: z.string().max(500).optional(),
  modelProvider: z.enum(["OpenAI", "Anthropic", "Google Gemini", "DeepSeek", "Custom LLM"]).default("Anthropic"),
  agentType: z.enum(["Autonomous Agent", "Coding Assistant", "CI/CD Pipeline", "Data Extractor", "Customer Support Bot"]).default("Coding Assistant"),
  allowedSecrets: z.array(z.string().uuid()).default([]),
  environment: z.enum(["development", "staging", "production"]).default("development"),
  ephemeralTtlMinutes: z.number().int().min(5).max(10080).default(60),
  tokenLimitPerHour: z.number().int().min(1000).max(1000000).default(50000),
  autoMaskSecrets: z.boolean().default(true),
});

const UpdateAgentSchema = CreateAgentSchema.partial().extend({
  agentId: z.string().uuid("Invalid Agent ID format"),
  status: z.enum(["active", "sandboxed", "revoked", "rate_limited"]).optional(),
});

const RotateAgentTokenSchema = z.object({
  agentId: z.string().uuid("Invalid Agent ID format"),
});

const DeleteAgentSchema = z.object({
  agentId: z.string().uuid("Invalid Agent ID format"),
});

// ============================================================================
// Helper Functions
// ============================================================================

async function logActivity(
  projectId: string,
  userId: string,
  userEmail: string,
  action: string,
  resourceName: string,
  environment: string = "production",
  details: string = ""
) {
  await db.insert(activityLogs).values({
    id: randomUUID(),
    projectId,
    userName: userId,
    userEmail,
    action,
    resourceName,
    environment: environment as "development" | "staging" | "production",
    details,
  });
}

function generateAgentToken(prefix: string = "axm"): { fullToken: string; tokenHash: string; tokenLastFour: string } {
  const randomPart = generateSecureToken(24);
  const fullToken = `${prefix}_${randomPart}`;
  const tokenHash = hashToken(fullToken);
  const tokenLastFour = getTokenSuffix(fullToken);
  return { fullToken, tokenHash, tokenLastFour };
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Creates a new agent harness
 */
export async function createAgentAction(input: z.infer<typeof CreateAgentSchema>) {
  const user = await getCurrentUser();

  // Validate input
  const parsed = CreateAgentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  // Check permissions
  authorize(user, "agent:write");

  const data = parsed.data;

  try {
    // Verify project access
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, data.projectId),
    });

    if (!project) {
      return { success: false, error: "Project not found" };
    }

    // Generate agent token
    const tokenPrefix = data.name.toLowerCase().replace(/\s+/g, "-").slice(0, 8);
    const { fullToken, tokenHash, tokenLastFour } = generateAgentToken(tokenPrefix);

    // Create agent harness
    const [agent] = await db.insert(agentHarnesses).values({
      id: randomUUID(),
      projectId: data.projectId,
      name: data.name,
      description: data.description || "",
      modelProvider: data.modelProvider,
      agentType: data.agentType,
      allowedSecrets: data.allowedSecrets,
      environment: data.environment,
      ephemeralTtlMinutes: data.ephemeralTtlMinutes,
      tokenLimitPerHour: data.tokenLimitPerHour,
      apiKeyAlias: `${tokenPrefix}_${generateSecureToken(8)}`,
      tokenPrefix,
      tokenHash,
      tokenLastFour,
      autoMaskSecrets: data.autoMaskSecrets,
      status: "active",
    }).returning();

    // Log activity
    await logActivity(
      data.projectId,
      user!.userId,
      user!.email,
      "AGENT_TOKEN_ISSUED",
      agent.name,
      data.environment,
      `Created agent with token prefix: ${tokenPrefix}`
    );

    revalidatePath(`/projects/${data.projectId}/agents`);

    return {
      success: true,
      data: {
        agent,
        // Only return full token once at creation
        token: fullToken,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create agent" };
  }
}

/**
 * Invokes an agent with a prompt
 */
export async function invokeAgentAction(input: z.infer<typeof InvokeAgentSchema>) {
  const user = await getCurrentUser();

  // Validate input
  const parsed = InvokeAgentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  const data = parsed.data;

  try {
    // Get agent
    const agent = await db.query.agentHarnesses.findFirst({
      where: eq(agentHarnesses.id, data.agentId),
    });

    if (!agent) {
      return { success: false, error: "Agent not found" };
    }

    // Check permissions - agents can invoke themselves via token auth
    if (user?.role !== "agent") {
      authorize(user, "agent:invoke");
    }

    // Check rate limiting
    if (agent.tokensUsedToday >= agent.tokenLimitPerHour) {
      await db.update(agentHarnesses)
        .set({ status: "rate_limited" })
        .where(eq(agentHarnesses.id, agent.id));
      return { success: false, error: "Agent rate limit exceeded" };
    }

    // Get allowed secrets for this agent
    let secretContext = "";
    if (agent.allowedSecrets.length > 0) {
      const allowedSecrets = await db.query.secrets.findMany({
        where: and(
          eq(secrets.projectId, agent.projectId),
          // Note: In production, use proper IN clause
        ),
      });

      // Filter to only allowed secrets
      const filteredSecrets = allowedSecrets.filter(s =>
        agent.allowedSecrets.includes(s.id)
      );

      // Build context (in production, decrypt secrets)
      secretContext = filteredSecrets.map(s => `${s.key}: [ENCRYPTED]`).join("\n");
    }

    // Update last invoked and token usage
    await db.update(agentHarnesses)
      .set({
        lastInvoked: new Date(),
        tokensUsedToday: agent.tokensUsedToday + 1, // Simplified token counting
      })
      .where(eq(agentHarnesses.id, agent.id));

    // Log activity
    await logActivity(
      agent.projectId,
      user?.userId || "agent",
      user?.email || "agent@system.local",
      "AGENT_ACCESS_GRANTED",
      agent.name,
      data.environment || agent.environment,
      `Invoked agent with prompt length: ${data.prompt.length}`
    );

    // In production, this would call the actual LLM provider
    // For now, return a mock response
    return {
      success: true,
      data: {
        response: `[Mock Response] Agent "${agent.name}" (${agent.modelProvider}) processed your prompt.`,
        agentId: agent.id,
        modelProvider: agent.modelProvider,
        agentType: agent.agentType,
        secretContext: secretContext || "No secrets attached",
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to invoke agent" };
  }
}

/**
 * Updates an agent harness
 */
export async function updateAgentAction(input: z.infer<typeof UpdateAgentSchema>) {
  const user = await getCurrentUser();

  const parsed = UpdateAgentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  const { agentId, ...updateData } = parsed.data;

  authorize(user, "agent:write");

  try {
    const agent = await db.query.agentHarnesses.findFirst({
      where: eq(agentHarnesses.id, agentId),
    });

    if (!agent) {
      return { success: false, error: "Agent not found" };
    }

    // Check project access
    if (user?.projectId !== agent.projectId && user?.role !== "owner") {
      return { success: false, error: "Access denied to this agent" };
    }

    const [updatedAgent] = await db.update(agentHarnesses)
      .set({
        ...updateData,
      })
      .where(eq(agentHarnesses.id, agentId))
      .returning();

    await logActivity(
      agent.projectId,
      user!.userId,
      user!.email,
      "AGENT_ACCESS_GRANTED",
      agent.name,
      agent.environment,
      `Updated agent configuration`
    );

    revalidatePath(`/projects/${agent.projectId}/agents`);

    return { success: true, data: updatedAgent };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update agent" };
  }
}

/**
 * Rotates an agent's token
 */
export async function rotateAgentTokenAction(input: z.infer<typeof RotateAgentTokenSchema>) {
  const user = await getCurrentUser();

  const parsed = RotateAgentTokenSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  authorize(user, "agent:write");

  try {
    const agent = await db.query.agentHarnesses.findFirst({
      where: eq(agentHarnesses.id, parsed.data.agentId),
    });

    if (!agent) {
      return { success: false, error: "Agent not found" };
    }

    // Generate new token
    const { fullToken, tokenHash, tokenLastFour } = generateAgentToken(agent.tokenPrefix);

    const [updatedAgent] = await db.update(agentHarnesses)
      .set({
        tokenHash,
        tokenLastFour,
        status: "active", // Reset status on rotation
      })
      .where(eq(agentHarnesses.id, agent.id))
      .returning();

    await logActivity(
      agent.projectId,
      user!.userId,
      user!.email,
      "KEY_ROTATION",
      agent.name,
      agent.environment,
      `Rotated agent token`
    );

    revalidatePath(`/projects/${agent.projectId}/agents`);

    return {
      success: true,
      data: {
        agent: updatedAgent,
        token: fullToken, // Only returned once
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to rotate token" };
  }
}

/**
 * Deletes (revokes) an agent
 */
export async function deleteAgentAction(input: z.infer<typeof DeleteAgentSchema>) {
  const user = await getCurrentUser();

  const parsed = DeleteAgentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  authorize(user, "agent:delete");

  try {
    const agent = await db.query.agentHarnesses.findFirst({
      where: eq(agentHarnesses.id, parsed.data.agentId),
    });

    if (!agent) {
      return { success: false, error: "Agent not found" };
    }

    // Soft delete by setting status to revoked
    await db.update(agentHarnesses)
      .set({
        status: "revoked",
      })
      .where(eq(agentHarnesses.id, agent.id));

    await logActivity(
      agent.projectId,
      user!.userId,
      user!.email,
      "AGENT_KILLSWITCH_TRIGGERED",
      agent.name,
      agent.environment,
      `Revoked agent`
    );

    revalidatePath(`/projects/${agent.projectId}/agents`);

    return { success: true, message: "Agent revoked successfully" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete agent" };
  }
}

/**
 * Gets agent details (for dashboard)
 */
export async function getAgentAction(agentId: string) {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const agent = await db.query.agentHarnesses.findFirst({
      where: eq(agentHarnesses.id, agentId),
      with: {
        // Note: Drizzle relations would need to be defined in schema for this to work
      },
    });

    if (!agent) {
      return { success: false, error: "Agent not found" };
    }

    // Check project access
    if (user.projectId !== agent.projectId && user.role !== "owner") {
      return { success: false, error: "Access denied" };
    }

    // Mask sensitive fields
    const safeAgent = {
      ...agent,
      tokenHash: "[REDACTED]",
      apiKeyAlias: agent.apiKeyAlias,
    };

    return { success: true, data: safeAgent };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch agent" };
  }
}

/**
 * Lists agents for a project
 */
export async function listAgentsAction(projectId: string) {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  authorize(user, "agent:read");

  try {
    const agents = await db.query.agentHarnesses.findMany({
      where: eq(agentHarnesses.projectId, projectId),
      orderBy: (agentHarnesses, { desc }) => [desc(agentHarnesses.createdAt)],
    });

    // Mask sensitive fields
    const safeAgents = agents.map(agent => ({
      ...agent,
      tokenHash: "[REDACTED]",
    }));

    return { success: true, data: safeAgents };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to list agents" };
  }
}