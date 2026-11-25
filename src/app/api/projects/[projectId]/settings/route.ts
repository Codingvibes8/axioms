import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { projectSettings, projects } from "@/lib/db/schema";
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
import { getCurrentUser, authorize, authorizeRole } from "@/lib/auth/rbac";
import { revalidatePath } from "next/cache";
import { generateSecureToken } from "@/lib/crypto";

// ============================================================================
// Schemas
// ============================================================================

const UpdateSettingsSchema = z.object({
  autoBackupEnabled: z.boolean().optional(),
  slackWebhookUrl: z.string().url().optional().nullable().transform((v) => v ?? undefined),
  discordWebhookUrl: z.string().url().optional().nullable().transform((v) => v ?? undefined),
  pagerdutyKey: z.string().optional().nullable().transform((v) => v ?? undefined),
  requireMfaForProduction: z.boolean().optional(),
  enableAgentProxyFirewall: z.boolean().optional(),
  auditRetentionDays: z.number().int().min(1).max(3650).optional(),
});

const RotateMasterKeySchema = z.object({
  confirm: z.literal(true),
});

const ResetProjectSchema = z.object({
  confirm: z.literal(true),
  ownerClerkUserId: z.string().optional(),
  ownerName: z.string().optional(),
  ownerEmail: z.string().email().optional(),
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
// GET /api/projects/[projectId]/settings - Get project settings
// ============================================================================

export const GET = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId } = await params;

  await checkProjectAccess(user, projectId, "project:settings");

  const settings = await db.query.projectSettings.findFirst({
    where: eq(projectSettings.projectId, projectId),
  });

  if (!settings) {
    return ApiErrors.notFound("Project settings");
  }

  return createSuccessResponse(settings);
});

// ============================================================================
// PATCH /api/projects/[projectId]/settings - Update project settings
// ============================================================================

export const PATCH = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId } = await params;

  await checkProjectAccess(user, projectId, "project:settings");

  const bodyValidation = await validateRequestBody(request, UpdateSettingsSchema);
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }

  const data = bodyValidation.data;

  const [settings] = await db
    .update(projectSettings)
    .set(data)
    .where(eq(projectSettings.projectId, projectId))
    .returning();

  revalidatePath("/dashboard");

  return createSuccessResponse(settings);
});

// ============================================================================
// POST /api/projects/[projectId]/settings/rotate-master-key - Rotate master key
// ============================================================================

export const POST = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId } = await params;

  await checkProjectAccess(user, projectId, "project:settings");
  authorizeRole(user, "owner");

  const bodyValidation = await validateRequestBody(request, RotateMasterKeySchema);
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }

  const settings = await db.query.projectSettings.findFirst({
    where: eq(projectSettings.projectId, projectId),
  });

  if (!settings) {
    return ApiErrors.notFound("Project settings");
  }

  // Generate new master key fingerprint
  const newFingerprint = `SHA256:${generateSecureToken(32)}`;

  await db
    .update(projectSettings)
    .set({ masterKeyFingerprint: newFingerprint })
    .where(eq(projectSettings.projectId, projectId));

  revalidatePath("/dashboard");

  return createSuccessResponse({ masterKeyFingerprint: newFingerprint });
});