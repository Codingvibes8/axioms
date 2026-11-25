import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { agentHarnesses, secrets } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import {
  createSuccessResponse,
  createErrorResponse,
  validateRequestBody,
  withErrorHandling,
  ApiErrors,
} from "@/lib/api/errors";
import { getCurrentUser, authorize, authorizeRole } from "@/lib/auth/rbac";
import { revalidatePath } from "next/cache";
import { hashToken, generateSecureToken, getTokenSuffix } from "@/lib/crypto";

// ============================================================================
// Schemas
// ============================================================================

const VALID_ENVIRONMENTS = ["development", "staging", "production"] as const;
const VALID_AGENT_STATUSES = ["active", "sandboxed", "revoked", "rate_limited"] as const;
const VALID_MODEL_PROVIDERS = ["OpenAI", "Anthropic", "Google Gemini", "DeepSeek", "Custom LLM"] as const;
const VALID_AGENT_TYPES = [
  "Autonomous Agent",
  "Coding Assistant",
  "CI/CD Pipeline",
  "Data Extractor",
  "Customer Support Bot",
] as const;

const UpdateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  modelProvider: z.enum(VALID_MODEL_PROVIDERS).optional(),
  agentType: z.enum(VALID_AGENT_TYPES).optional(),
  allowedSecrets: z.array(z.string().uuid()).optional(),
  environment: z.enum(VALID_ENVIRONMENTS).optional(),
  ephemeralTtlMinutes: z.number().int().min(5).max(10080).optional(),
  tokenLimitPerHour: z.number().int().min(1000).max(1000000).optional(),
  autoMaskSecrets: z.boolean().optional(),
  status: z.enum(VALID_AGENT_STATUSES).optional(),
});

const UpdateStatusSchema = z.object({
  status: z.enum(VALID_AGENT_STATUSES),
});

const RotateTokenSchema = z.object({});

const ExtendTTLSchema = z.object({
  additionalMinutes: z.number().int().min(1).max(10080),
});

const TriggerKillSwitchSchema = z.object({
  reason: z.string().max(500).optional(),
});

// ============================================================================
// Helper: Check project access
// ============================================================================

async function checkProjectAccess(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  projectId: string,
  requiredPermission?: string
) {
  if (!user) throw new Error("Unauthorized");
  if (user.role !== "owner" && user.projectId !== projectId) {
    throw new Error("Access denied to this project");
  }
  if (requiredPermission) {
    authorize(user, requiredPermission as any);
  }
}

function generateAgentToken(prefix: string = "axm") {
  const randomPart = generateSecureToken(24);
  const fullToken = `${prefix}_${randomPart}`;
  const tokenHash = hashToken(fullToken);
  const tokenLastFour = getTokenSuffix(fullToken);
  return { fullToken, tokenHash, tokenLastFour };
}

// ============================================================================
// GET /api/projects/[projectId]/agents/[agentId] - Get agent
// ============================================================================

export const GET = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; agentId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId, agentId } = await params;

  await checkProjectAccess(user, projectId, "agent:read");

  const agent = await db.query.agentHarnesses.findFirst({
    where: and(
      eq(agentHarnesses.id, agentId),
      eq(agentHarnesses.projectId, projectId)
    ),
  });

  if (!agent) {
    return ApiErrors.notFound("Agent");
  }

  return createSuccessResponse({ ...agent, tokenHash: "[REDACTED]" });
});

// ============================================================================
// PATCH /api/projects/[projectId]/agents/[agentId] - Update agent
// ============================================================================

export const PATCH = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; agentId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId, agentId } = await params;

  await checkProjectAccess(user, projectId, "agent:write");

  const agent = await db.query.agentHarnesses.findFirst({
    where: and(
      eq(agentHarnesses.id, agentId),
      eq(agentHarnesses.projectId, projectId)
    ),
  });

  if (!agent) {
    return ApiErrors.notFound("Agent");
  }

  const bodyValidation = await validateRequestBody(request, UpdateAgentSchema);
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }

  const { allowedSecrets, ...updateData } = bodyValidation.data;

  // Verify allowed secrets if provided
  if (allowedSecrets && allowedSecrets.length > 0) {
    const existingSecrets = await db.query.secrets.findMany({
      where: and(
        eq(secrets.projectId, projectId),
        sql`${secrets.id} = ANY(${allowedSecrets})`
      ),
    });

    if (existingSecrets.length !== allowedSecrets.length) {
      return createErrorResponse(
        "One or more allowed secrets not found",
        "BAD_REQUEST",
        { requested: allowedSecrets.length, found: existingSecrets.length },
        400
      );
    }
  }

  const [updatedAgent] = await db
    .update(agentHarnesses)
    .set({
      ...updateData,
      ...(allowedSecrets && { allowedSecrets }),
    })
    .where(eq(agentHarnesses.id, agentId))
    .returning();

  revalidatePath("/dashboard");

  return createSuccessResponse({ ...updatedAgent, tokenHash: "[REDACTED]" });
});

// ============================================================================
// DELETE /api/projects/[projectId]/agents/[agentId] - Delete agent (revoke)
// ============================================================================

export const DELETE = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; agentId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId, agentId } = await params;

  await checkProjectAccess(user, projectId, "agent:delete");

  const agent = await db.query.agentHarnesses.findFirst({
    where: and(
      eq(agentHarnesses.id, agentId),
      eq(agentHarnesses.projectId, projectId)
    ),
  });

  if (!agent) {
    return ApiErrors.notFound("Agent");
  }

  await db
    .update(agentHarnesses)
    .set({ status: "revoked" })
    .where(eq(agentHarnesses.id, agentId));

  revalidatePath("/dashboard");

  return createSuccessResponse({ message: "Agent revoked successfully" });
});

// ============================================================================
// POST /api/projects/[projectId]/agents/[agentId]/rotate-token - Rotate agent token
// ============================================================================

export const POST = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; agentId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId, agentId } = await params;

  await checkProjectAccess(user, projectId, "agent:write");

  const agent = await db.query.agentHarnesses.findFirst({
    where: and(
      eq(agentHarnesses.id, agentId),
      eq(agentHarnesses.projectId, projectId)
    ),
  });

  if (!agent) {
    return ApiErrors.notFound("Agent");
  }

  const bodyValidation = await validateRequestBody(request, RotateTokenSchema);
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }

  const { fullToken, tokenHash, tokenLastFour } = generateAgentToken(agent.tokenPrefix);

  const [updatedAgent] = await db
    .update(agentHarnesses)
    .set({
      tokenHash,
      tokenLastFour,
      status: "active",
      expiresAt: new Date(Date.now() + agent.ephemeralTtlMinutes * 60 * 1000),
      tokensUsedToday: 0,
    })
    .where(eq(agentHarnesses.id, agentId))
    .returning();

  revalidatePath("/dashboard");

  return createSuccessResponse(
    {
      agent: { ...updatedAgent, tokenHash: "[REDACTED]" },
      token: fullToken, // Only returned once
    },
    {},
    200
  );
});