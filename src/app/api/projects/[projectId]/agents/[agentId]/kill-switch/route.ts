import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { agentHarnesses } from "@/lib/db/schema";
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

// ============================================================================
// POST /api/projects/[projectId]/agents/[agentId]/kill-switch - Trigger kill switch
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

  const bodyValidation = await validateRequestBody(request, TriggerKillSwitchSchema);
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }

  await db
    .update(agentHarnesses)
    .set({ status: "revoked" })
    .where(eq(agentHarnesses.id, agentId));

  revalidatePath("/dashboard");

  return createSuccessResponse({
    message: "Kill switch triggered successfully",
    reason: bodyValidation.data.reason,
  });
});