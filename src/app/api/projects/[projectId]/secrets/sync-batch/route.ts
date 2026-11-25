import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { secrets, secretVersions } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
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

const SyncEnvBatchSchema = z.object({
  sourceEnvironment: z.enum(VALID_ENVIRONMENTS),
  targetEnvironment: z.enum(VALID_ENVIRONMENTS),
  secretKeys: z.array(z.string()).optional(),
  overwrite: z.boolean().default(false),
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
// POST /api/projects/[projectId]/secrets/sync-batch - Batch sync secrets between environments
// ============================================================================

export const POST = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId } = await params;

  await checkProjectAccess(user, projectId, "secret:write");

  const bodyValidation = await validateRequestBody(request, SyncEnvBatchSchema);
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }

  const { sourceEnvironment, targetEnvironment, secretKeys, overwrite } = bodyValidation.data;

  if (sourceEnvironment === targetEnvironment) {
    return createErrorResponse(
      "Source and target environments must be different",
      "BAD_REQUEST",
      undefined,
      400
    );
  }

  const whereConditions = [
    eq(secrets.projectId, projectId),
    eq(secrets.environment, sourceEnvironment),
  ];

  if (secretKeys && secretKeys.length > 0) {
    whereConditions.push(sql`${secrets.key} = ANY(${secretKeys})`);
  }

  const sourceSecrets = await db.query.secrets.findMany({
    where: and(...whereConditions),
  });

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const secret of sourceSecrets) {
    try {
      const existing = await db.query.secrets.findFirst({
        where: and(
          eq(secrets.projectId, secret.projectId),
          eq(secrets.key, secret.key),
          eq(secrets.environment, targetEnvironment)
        ),
      });

      if (existing && !overwrite) {
        skipped++;
        continue;
      }

      if (existing && overwrite) {
        await db
          .update(secrets)
          .set({
            value: secret.value,
            category: secret.category,
            description: secret.description,
            tags: secret.tags,
            version: existing.version + 1,
            updatedAt: new Date(),
            updatedBy: user!.email,
          })
          .where(eq(secrets.id, existing.id));

        await db.insert(secretVersions).values({
          id: `${existing.id}_v${existing.version + 1}`,
          secretId: existing.id,
          version: existing.version + 1,
          value: secret.value,
          comment: `Overwritten from ${sourceEnvironment}`,
          createdBy: user!.email,
        });
      } else {
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
          comment: `Synced from ${sourceEnvironment}`,
          createdBy: user!.email,
        });
      }

      synced++;
    } catch (err) {
      errors.push(
        `Failed to sync ${secret.key}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  revalidatePath("/dashboard");

  return createSuccessResponse({ synced, skipped, errors });
});