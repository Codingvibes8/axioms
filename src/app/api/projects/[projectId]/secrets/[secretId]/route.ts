import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { secrets, secretVersions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import {
  createSuccessResponse,
  createErrorResponse,
  validateRequestBody,
  withErrorHandling,
  ApiErrors,
} from "@/lib/api/errors";
import { getCurrentUser, authorize } from "@/lib/auth/rbac";
import { revalidatePath } from "next/cache";
import { encryptData, decryptData } from "@/lib/crypto";

// ============================================================================
// Schemas
// ============================================================================

const VALID_CATEGORIES = [
  "API Key",
  "Database",
  "OAuth",
  "AI / LLM",
  "Cloud",
  "Infra",
  "General",
] as const;

const VALID_ENVIRONMENTS = ["development", "staging", "production"] as const;

const UpdateSecretSchema = z.object({
  key: z.string().min(1).max(100).optional(),
  value: z.string().min(1).optional(),
  environment: z.enum(VALID_ENVIRONMENTS).optional(),
  category: z.enum(VALID_CATEGORIES).optional(),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
  isEphemeral: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

const RollbackSchema = z.object({
  targetVersion: z.number().int().positive("Target version must be positive"),
});

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
// GET /api/projects/[projectId]/secrets/[secretId] - Get secret
// ============================================================================

export const GET = withErrorHandling(async (
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

  await checkProjectAccess(user, secret.projectId, "secret:read");

  const canViewValue = user?.role === "owner" || user?.role === "admin";

  return createSuccessResponse({
    ...secret,
    value: canViewValue ? secret.value : "[ENCRYPTED]",
  });
});

// ============================================================================
// PATCH /api/projects/[projectId]/secrets/[secretId] - Update secret
// ============================================================================

export const PATCH = withErrorHandling(async (
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

  const bodyValidation = await validateRequestBody(request, UpdateSecretSchema);
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }

  const { value, ...updateData } = bodyValidation.data;

  // Check for duplicate key if changing key/environment
  if ((updateData.key || updateData.environment) &&
      (updateData.key !== secret.key || updateData.environment !== secret.environment)) {
    const existing = await db.query.secrets.findFirst({
      where: and(
        eq(secrets.projectId, projectId),
        eq(secrets.key, updateData.key ?? secret.key),
        eq(secrets.environment, updateData.environment ?? secret.environment)
      ),
    });
    if (existing) {
      return createErrorResponse(
        "Secret with this key already exists in the target environment",
        "CONFLICT",
        { key: updateData.key ?? secret.key, environment: updateData.environment ?? secret.environment },
        409
      );
    }
  }

  const updatePayload: any = {
    ...updateData,
    updatedAt: new Date(),
    updatedBy: user!.email,
  };

  let createdNewVersion = false;
  if (value) {
    updatePayload.value = encryptData(value);
    updatePayload.lastRotatedAt = new Date();
    createdNewVersion = true;
  }

  const [updatedSecret] = await db
    .update(secrets)
    .set(updatePayload)
    .where(eq(secrets.id, secretId))
    .returning();

  if (createdNewVersion) {
    const newVersion = secret.version + 1;
    await db.insert(secretVersions).values({
      id: `${secretId}_v${newVersion}`,
      secretId,
      version: newVersion,
      value: updatePayload.value,
      comment: "Updated via API",
      createdBy: user!.email,
    });
  }

  revalidatePath("/dashboard");

  return createSuccessResponse({ ...updatedSecret, value: "[ENCRYPTED]" });
});

// ============================================================================
// DELETE /api/projects/[projectId]/secrets/[secretId] - Delete secret
// ============================================================================

export const DELETE = withErrorHandling(async (
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

  await checkProjectAccess(user, secret.projectId, "secret:delete");

  await db.delete(secrets).where(eq(secrets.id, secretId));

  revalidatePath("/dashboard");

  return createSuccessResponse({ message: "Secret deleted successfully" });
});

// ============================================================================
// POST /api/projects/[projectId]/secrets/[secretId]/rollback - Rollback secret
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

  await checkProjectAccess(user, secret.projectId, "secret:rollback");

  const bodyValidation = await validateRequestBody(request, RollbackSchema);
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }

  if (bodyValidation.data.targetVersion >= secret.version) {
    return createErrorResponse(
      "Target version must be less than current version",
      "BAD_REQUEST",
      { currentVersion: secret.version, targetVersion: bodyValidation.data.targetVersion },
      400
    );
  }

  const targetVersion = await db.query.secretVersions.findFirst({
    where: and(
      eq(secretVersions.secretId, secretId),
      eq(secretVersions.version, bodyValidation.data.targetVersion)
    ),
  });

  if (!targetVersion) {
    return ApiErrors.notFound("Target version");
  }

  const newVersion = secret.version + 1;

  await db.transaction(async (tx) => {
    await tx.insert(secretVersions).values({
      id: `${secretId}_v${newVersion}`,
      secretId,
      version: newVersion,
      value: targetVersion.value,
      comment: `Rolled back to version ${bodyValidation.data.targetVersion}`,
      createdBy: user!.email,
    });

    await tx
      .update(secrets)
      .set({
        value: targetVersion.value,
        version: newVersion,
        lastRotatedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: user!.email,
      })
      .where(eq(secrets.id, secretId));
  });

  revalidatePath("/dashboard");

  return createSuccessResponse({ message: "Secret rolled back successfully" });
});