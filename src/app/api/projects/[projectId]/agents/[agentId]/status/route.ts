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

const VALID_AGENT_STATUSES = ["active", "sandboxed", "revoked", "rate_limited"] as const;

const UpdateStatusSchema = z.object({
  status: z.enum(VALID_AGENT_STATUSES),
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
// PATCH /api/projects/[projectId]/agents/[agentId]/status - Update agent status
// ============================================================================

export const PATCH = withErrorHandling(async (
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

  const bodyValidation = await validateRequestBody(request, UpdateStatusSchema);
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }

  const { status } = bodyValidation.data;

  // If activating, update expiry
  const updateData: any = { status };
  if (status === "active") {
    updateData.expiresAt = new Date(Date.now() + agent.ephemeralTtlMinutes * 60 * 1000);
  }

  const [updatedAgent] = await db
    .update(agentHarnesses)
    .set(updateData)
    .where(eq(agentHarnesses.id, agentId))
    .returning();

  revalidatePath("/dashboard");

  return createSuccessResponse({ ...updatedAgent, tokenHash: "[REDACTED]" });
});