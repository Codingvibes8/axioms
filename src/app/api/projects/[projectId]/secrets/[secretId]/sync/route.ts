import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { secrets, secretVersions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  createSuccessResponse,
  createErrorResponse,
  validateRequestBody,
  withErrorHandling,
  ApiErrors,
} from "@/lib/api/errors";
import { getCurrentUser, authorize } from "@/lib/auth/rbac";
import { revalidatePath } from "next/cache";

// ============================================================================
// Schemas
// ============================================================================

const VALID_ENVIRONMENTS = ["development", "staging", "production"] as const;

const SyncToEnvSchema = z.object({
  targetEnvironment: z.enum(VALID_ENVIRONMENTS),
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
// POST /api/projects/[projectId]/secrets/[secretId]/sync - Sync secret to another environment
// ============================================================================

export const POST = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; secretId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId, secretId } = await params;

  const secret = await db.query.secrets.findFirst({
    where: eq(secrets.id, secretId),
  });

  if (!secret) {
    return ApiErrors.notFound("Secret");
  }

  await checkProjectAccess(user, secret.projectId, "secret:write");

  const bodyValidation = await validateRequestBody(request, SyncToEnvSchema);
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }

  const { targetEnvironment } = bodyValidation.data;

  if (secret.environment === targetEnvironment) {
    return createErrorResponse(
      "Source and target environments must be different",
      "BAD_REQUEST",
      undefined,
      400
    );
  }

  // Check if secret already exists in target environment
  const existing = await db.query.secrets.findFirst({
    where: and(
      eq(secrets.projectId, secret.projectId),
      eq(secrets.key, secret.key),
      eq(secrets.environment, targetEnvironment)
    ),
  });

  if (existing) {
    return createErrorResponse(
      `Secret "${secret.key}" already exists in ${targetEnvironment} environment`,
      "CONFLICT",
      { key: secret.key, environment: targetEnvironment },
      409
    );
  }

  const [newSecret] = await db
    .insert(secrets)
    .values({
      id: randomUUID(),
      projectId: secret.projectId,
      key: secret.key,
      value: secret.value,
      environment: targetEnvironment,
      category: secret.category,
      description: secret.description,
      tags: secret.tags,
      version: 1,
      isEphemeral: secret.isEphemeral,
      expiresAt: secret.expiresAt,
      updatedBy: user!.email,
    })
    .returning();

  await db.insert(secretVersions).values({
    id: `${newSecret.id}_v1`,
    secretId: newSecret.id,
    version: 1,
    value: secret.value,
    comment: `Synced from ${secret.environment} environment`,
    createdBy: user!.email,
  });

  revalidatePath("/dashboard");

  return createSuccessResponse({ ...newSecret, value: "[ENCRYPTED]" }, {}, 201);
});