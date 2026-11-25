import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { teamMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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

// ============================================================================
// Schemas
// ============================================================================

const VALID_ROLES = ["owner", "admin", "developer", "viewer", "agent"] as const;
const VALID_ENVIRONMENTS = ["development", "staging", "production"] as const;

const UpdateTeamMemberSchema = z.object({
  role: z.enum(VALID_ROLES).optional(),
  allowedEnvironments: z.array(z.enum(VALID_ENVIRONMENTS)).optional(),
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
// GET /api/projects/[projectId]/team/[memberId] - Get team member
// ============================================================================

export const GET = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; memberId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId, memberId } = await params;

  await checkProjectAccess(user, projectId, "team:manage");

  const member = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.id, memberId),
      eq(teamMembers.projectId, projectId)
    ),
  });

  if (!member) {
    return ApiErrors.notFound("Team member");
  }

  return createSuccessResponse(member);
});

// ============================================================================
// PATCH /api/projects/[projectId]/team/[memberId] - Update team member
// ============================================================================

export const PATCH = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; memberId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId, memberId } = await params;

  await checkProjectAccess(user, projectId, "team:manage");

  const member = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.id, memberId),
      eq(teamMembers.projectId, projectId)
    ),
  });

  if (!member) {
    return ApiErrors.notFound("Team member");
  }

  const bodyValidation = await validateRequestBody(request, UpdateTeamMemberSchema);
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }

  const { role, allowedEnvironments } = bodyValidation.data;

  // Prevent demoting the last owner
  if (member.role === "owner" && role && role !== "owner") {
    const ownerCount = await db.$count(
      teamMembers,
      and(
        eq(teamMembers.projectId, projectId),
        eq(teamMembers.role, "owner")
      )
    );
    if (ownerCount <= 1) {
      return createErrorResponse(
        "Cannot demote the last owner of the project",
        "FORBIDDEN",
        undefined,
        403
      );
    }
  }

  const [updatedMember] = await db
    .update(teamMembers)
    .set({
      ...(role && { role }),
      ...(allowedEnvironments && { allowedEnvironments }),
      lastActive: new Date(),
    })
    .where(eq(teamMembers.id, memberId))
    .returning();

  revalidatePath("/dashboard");

  return createSuccessResponse(updatedMember);
});

// ============================================================================
// DELETE /api/projects/[projectId]/team/[memberId] - Remove team member
// ============================================================================

export const DELETE = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; memberId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId, memberId } = await params;

  await checkProjectAccess(user, projectId, "team:manage");

  const member = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.id, memberId),
      eq(teamMembers.projectId, projectId)
    ),
  });

  if (!member) {
    return ApiErrors.notFound("Team member");
  }

  // Prevent removing the last owner
  if (member.role === "owner") {
    const ownerCount = await db.$count(
      teamMembers,
      and(
        eq(teamMembers.projectId, projectId),
        eq(teamMembers.role, "owner")
      )
    );
    if (ownerCount <= 1) {
      return createErrorResponse(
        "Cannot remove the last owner of the project",
        "FORBIDDEN",
        undefined,
        403
      );
    }
  }

  await db.delete(teamMembers).where(eq(teamMembers.id, memberId));

  revalidatePath("/dashboard");

  return createSuccessResponse({ message: "Team member removed successfully" });
});