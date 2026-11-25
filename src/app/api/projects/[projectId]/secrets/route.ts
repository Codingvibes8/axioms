import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { secrets, secretVersions, projects } from "@/lib/db/schema";
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
import { encryptData, decryptData } from "@/lib/crypto";

// ============================================================================
// Schemas
// ============================================================================

const VALID_ENVIRONMENTS = ["development", "staging", "production"] as const;
const VALID_CATEGORIES = [
  "API Key",
  "Database",
  "OAuth",
  "AI / LLM",
  "Cloud",
  "Infra",
  "General",
] as const;

const CreateSecretSchema = z.object({
  key: z.string().min(1, "Secret key is required").max(100),
  value: z.string().min(1, "Secret value is required"),
  environment: z.enum(VALID_ENVIRONMENTS).default("development"),
  category: z.enum(VALID_CATEGORIES).default("General"),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).default([]),
  isEphemeral: z.boolean().default(false),
  expiresAt: z.string().datetime().optional().nullable(),
});

const ListSecretsQuerySchema = z.object({
  environment: z.enum(VALID_ENVIRONMENTS).optional(),
  category: z.enum(VALID_CATEGORIES).optional(),
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

// ============================================================================
// GET /api/projects/[projectId]/secrets - List secrets
// ============================================================================

export const GET = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId } = await params;

  await checkProjectAccess(user, projectId, "secret:read");

  const { searchParams } = new URL(request.url);
  const queryValidation = validateQueryParams(searchParams, ListSecretsQuerySchema);
  if (!queryValidation.success) {
    return queryValidation.response;
  }

  const { environment, category, limit, offset } = queryValidation.data;

  const whereConditions = [eq(secrets.projectId, projectId)];
  if (environment) whereConditions.push(eq(secrets.environment, environment));
  if (category) whereConditions.push(eq(secrets.category, category));

  const secretList = await db.query.secrets.findMany({
    where: and(...whereConditions),
    orderBy: (secrets, { desc }) => [desc(secrets.updatedAt)],
    limit,
    offset,
  });

  // Mask values for non-owner/admin
  const canViewValues = user?.role === "owner" || user?.role === "admin";
  const safeSecrets = secretList.map((s) => ({
    ...s,
    value: canViewValues ? s.value : "[ENCRYPTED]",
  }));

  const total = await db.$count(secrets, and(...whereConditions));

  return createSuccessResponse(safeSecrets, { limit, offset, total });
});

// ============================================================================
// POST /api/projects/[projectId]/secrets - Create secret
// ============================================================================

export const POST = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId } = await params;

  await checkProjectAccess(user, projectId, "secret:write");

  const bodyValidation = await validateRequestBody(request, CreateSecretSchema);
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }

  const data = bodyValidation.data;

  // Check for duplicate key in same environment
  const existing = await db.query.secrets.findFirst({
    where: and(
      eq(secrets.projectId, projectId),
      eq(secrets.key, data.key),
      eq(secrets.environment, data.environment)
    ),
  });

  if (existing) {
    return createErrorResponse(
      `Secret with key "${data.key}" already exists in ${data.environment} environment`,
      "CONFLICT",
      { key: data.key, environment: data.environment },
      409
    );
  }

  const encryptedValue = encryptData(data.value);

  const [secret] = await db
    .insert(secrets)
    .values({
      id: randomUUID(),
      projectId,
      key: data.key,
      value: encryptedValue,
      environment: data.environment,
      category: data.category,
      description: data.description || "",
      tags: data.tags,
      isEphemeral: data.isEphemeral,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      updatedBy: user!.email,
    })
    .returning();

  // Create initial version
  await db.insert(secretVersions).values({
    id: `${secret.id}_v1`,
    secretId: secret.id,
    version: 1,
    value: encryptedValue,
    comment: "Initial version",
    createdBy: user!.email,
  });

  revalidatePath("/dashboard");

  return createSuccessResponse({ ...secret, value: "[ENCRYPTED]" }, {}, 201);
});