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

const ExtendTTLSchema = z.object({
  additionalMinutes: z.number().int().min(1).max(10080),
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
// POST /api/projects/[projectId]/agents/[agentId]/extend-ttl - Extend agent TTL
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

  const bodyValidation = await validateRequestBody(request, ExtendTTLSchema);
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }

  const { additionalMinutes } = bodyValidation.data;

  const currentExpiry = agent.expiresAt ? new Date(agent.expiresAt) : new Date();
  const newExpiry = new Date(currentExpiry.getTime() + additionalMinutes * 60 * 1000);

  const [updatedAgent] = await db
    .update(agentHarnesses)
    .set({ expiresAt: newExpiry })
    .where(eq(agentHarnesses.id, agentId))
    .returning();

  revalidatePath("/dashboard");

  return createSuccessResponse({ ...updatedAgent, tokenHash: "[REDACTED]" });
});