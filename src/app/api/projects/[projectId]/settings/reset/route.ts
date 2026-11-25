import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { activityLogs, agentHarnesses, projectSettings, secretVersions, secrets, teamMembers } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import {
  createSuccessResponse,
  createErrorResponse,
  validateRequestBody,
  withErrorHandling,
  ApiErrors,
} from "@/lib/api/errors";
import { getCurrentUser, authorizeRole } from "@/lib/auth/rbac";
import { revalidatePath } from "next/cache";
import { encryptData } from "@/lib/crypto";
import { seedDatabase } from "@/lib/seed";

// ============================================================================
// Schemas
// ============================================================================

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

// Import authorize
import { authorize } from "@/lib/auth/rbac";

// ============================================================================
// POST /api/projects/[projectId]/settings/reset - Reset project to seed
// ============================================================================

export const POST = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId } = await params;

  await checkProjectAccess(user, projectId, "project:write");
  authorizeRole(user, "owner");

  const bodyValidation = await validateRequestBody(request, ResetProjectSchema);
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }

  // Delete all related data (cascade will handle most)
  await db.delete(activityLogs).where(eq(activityLogs.projectId, projectId));
  await db.delete(secretVersions).where(
    sql`${secretVersions.secretId} IN (SELECT id FROM ${secrets} WHERE project_id = ${projectId})`
  );
  await db.delete(secrets).where(eq(secrets.projectId, projectId));
  await db.delete(agentHarnesses).where(eq(agentHarnesses.projectId, projectId));
  await db.delete(teamMembers).where(eq(teamMembers.projectId, projectId));
  await db.delete(projectSettings).where(eq(projectSettings.projectId, projectId));

  // Re-seed using the seed function
  await seedDatabase({
    ownerClerkUserId: bodyValidation.data.ownerClerkUserId,
    ownerName: bodyValidation.data.ownerName,
    ownerEmail: bodyValidation.data.ownerEmail,
    encryptSecretFn: encryptData,
  });

  revalidatePath("/dashboard");

  return createSuccessResponse({ message: "Project reset to seed state successfully" });
});