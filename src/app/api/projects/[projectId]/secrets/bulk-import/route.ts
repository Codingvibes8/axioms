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
import { encryptData } from "@/lib/crypto";

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

const SecretImportSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().min(1),
  category: z.enum(VALID_CATEGORIES).default("General"),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).default([]),
  isEphemeral: z.boolean().default(false),
  expiresAt: z.string().datetime().optional().nullable(),
});

const BulkImportSchema = z.object({
  environment: z.enum(VALID_ENVIRONMENTS),
  secrets: z.array(SecretImportSchema),
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
// POST /api/projects/[projectId]/secrets/bulk-import - Bulk import secrets
// ============================================================================

export const POST = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId } = await params;

  await checkProjectAccess(user, projectId, "secret:write");

  const bodyValidation = await validateRequestBody(request, BulkImportSchema);
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }

  const { environment, secrets: secretsToImport } = bodyValidation.data;

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const secretInput of secretsToImport) {
    try {
      const existing = await db.query.secrets.findFirst({
        where: and(
          eq(secrets.projectId, projectId),
          eq(secrets.key, secretInput.key),
          eq(secrets.environment, environment)
        ),
      });

      if (existing) {
        skipped++;
        continue;
      }

      const encryptedValue = encryptData(secretInput.value);

      const [secret] = await db
        .insert(secrets)
        .values({
          id: randomUUID(),
          projectId,
          key: secretInput.key,
          value: encryptedValue,
          environment,
          category: secretInput.category,
          description: secretInput.description || "",
          tags: secretInput.tags,
          isEphemeral: secretInput.isEphemeral,
          expiresAt: secretInput.expiresAt ? new Date(secretInput.expiresAt) : null,
          updatedBy: user!.email,
        })
        .returning();

      await db.insert(secretVersions).values({
        id: `${secret.id}_v1`,
        secretId: secret.id,
        version: 1,
        value: encryptedValue,
        comment: "Bulk imported",
        createdBy: user!.email,
      });

      imported++;
    } catch (err) {
      errors.push(
        `Failed to import ${secretInput.key}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  revalidatePath("/dashboard");

  return createSuccessResponse({ imported, skipped, errors });
});