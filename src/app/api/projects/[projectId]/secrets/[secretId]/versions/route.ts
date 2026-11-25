import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { secrets, secretVersions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import {
  createSuccessResponse,
  createErrorResponse,
  validateQueryParams,
  withErrorHandling,
  ApiErrors,
} from "@/lib/api/errors";
import { getCurrentUser, authorize } from "@/lib/auth/rbac";

// ============================================================================
// Schemas
// ============================================================================

const ListVersionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
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
// GET /api/projects/[projectId]/secrets/[secretId]/versions - List secret versions
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

  const { searchParams } = new URL(request.url);
  const queryValidation = validateQueryParams(searchParams, ListVersionsQuerySchema);
  if (!queryValidation.success) {
    return queryValidation.response;
  }

  const { limit, offset } = queryValidation.data;

  const versions = await db.query.secretVersions.findMany({
    where: eq(secretVersions.secretId, secretId),
    orderBy: (secretVersions, { desc }) => [desc(secretVersions.version)],
    limit,
    offset,
  });

  // Mask values for non-owner/admin
  const canViewValues = user?.role === "owner" || user?.role === "admin";
  const safeVersions = versions.map((v) => ({
    ...v,
    value: canViewValues ? v.value : "[ENCRYPTED]",
  }));

  const total = await db.$count(secretVersions, eq(secretVersions.secretId, secretId));

  return createSuccessResponse(safeVersions, { limit, offset, total });
});