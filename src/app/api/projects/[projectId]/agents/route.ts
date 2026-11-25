import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { agentHarnesses, secrets } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  createSuccessResponse,
  createErrorResponse,
  validateRequestBody,
  validateQueryParams,
  withErrorHandling,
  ApiErrors,
} from "@/lib/api/errors";
import { getCurrentUser, authorize } from "@/lib/auth/rbac";
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

const CreateAgentSchema = z.object({
  name: z.string().min(1, "Agent name is required").max(100),
  description: z.string().max(500).optional(),
  modelProvider: z.enum(VALID_MODEL_PROVIDERS).default("Anthropic"),
  agentType: z.enum(VALID_AGENT_TYPES).default("Coding Assistant"),
  allowedSecrets: z.array(z.string().uuid()).default([]),
  environment: z.enum(VALID_ENVIRONMENTS).default("development"),
  ephemeralTtlMinutes: z.number().int().min(5).max(10080).default(60),
  tokenLimitPerHour: z.number().int().min(1000).max(1000000).default(50000),
  autoMaskSecrets: z.boolean().default(true),
});

const ListAgentsQuerySchema = z.object({
  status: z.enum(VALID_AGENT_STATUSES).optional(),
  environment: z.enum(VALID_ENVIRONMENTS).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
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
// GET /api/projects/[projectId]/agents - List agents
// ============================================================================

export const GET = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId } = await params;

  await checkProjectAccess(user, projectId, "agent:read");

  const { searchParams } = new URL(request.url);
  const queryValidation = validateQueryParams(searchParams, ListAgentsQuerySchema);
  if (!queryValidation.success) {
    return queryValidation.response;
  }

  const { status, environment, limit, offset } = queryValidation.data;

  const whereConditions = [eq(agentHarnesses.projectId, projectId)];
  if (status) whereConditions.push(eq(agentHarnesses.status, status));
  if (environment) whereConditions.push(eq(agentHarnesses.environment, environment));

  const agents = await db.query.agentHarnesses.findMany({
    where: and(...whereConditions),
    orderBy: (agentHarnesses, { desc }) => [desc(agentHarnesses.createdAt)],
    limit,
    offset,
  });

  // Mask sensitive fields
  const safeAgents = agents.map((agent) => ({
    ...agent,
    tokenHash: "[REDACTED]",
  }));

  const total = await db.$count(agentHarnesses, and(...whereConditions));

  return createSuccessResponse(safeAgents, { limit, offset, total });
});

// ============================================================================
// POST /api/projects/[projectId]/agents - Create agent
// ============================================================================

export const POST = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId } = await params;

  await checkProjectAccess(user, projectId, "agent:write");

  const bodyValidation = await validateRequestBody(request, CreateAgentSchema);
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }

  const data = bodyValidation.data;

  // Verify all allowed secrets exist
  if (data.allowedSecrets.length > 0) {
    const existingSecrets = await db.query.secrets.findMany({
      where: and(
        eq(secrets.projectId, projectId),
        sql`${secrets.id} = ANY(${data.allowedSecrets})`
      ),
    });

    if (existingSecrets.length !== data.allowedSecrets.length) {
      return createErrorResponse(
        "One or more allowed secrets not found",
        "BAD_REQUEST",
        { requested: data.allowedSecrets.length, found: existingSecrets.length },
        400
      );
    }
  }

  const tokenPrefix = data.name.toLowerCase().replace(/\s+/g, "-").slice(0, 8);
  const { fullToken, tokenHash, tokenLastFour } = generateAgentToken(tokenPrefix);

  const [agent] = await db
    .insert(agentHarnesses)
    .values({
      id: randomUUID(),
      projectId,
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
      expiresAt: new Date(Date.now() + data.ephemeralTtlMinutes * 60 * 1000),
    })
    .returning();

  revalidatePath("/dashboard");

  return createSuccessResponse(
    {
      agent: { ...agent, tokenHash: "[REDACTED]" },
      token: fullToken, // Only returned once at creation
    },
    {},
    201
  );
});