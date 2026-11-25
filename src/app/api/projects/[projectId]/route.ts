import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { projects, projectSettings, teamMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import {
  createSuccessResponse,
  createErrorResponse,
  validateRequestBody,
  withErrorHandling,
  ApiErrors,
} from "@/lib/api/errors";
import { getCurrentUser, authorize, authorizeRole } from "@/lib/auth/rbac";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

// ============================================================================
// Schemas
// ============================================================================

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().max(500).optional(),
  encryptionAlgorithm: z.string().optional(),
  environments: z.array(z.enum(["development", "staging", "production"])).optional(),
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
// GET /api/projects/[projectId] - Get project
// ============================================================================

export const GET = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId } = await params;

  await checkProjectAccess(user, projectId, "project:read");

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    return ApiErrors.notFound("Project");
  }

  return createSuccessResponse(project);
});

// ============================================================================
// PATCH /api/projects/[projectId] - Update project
// ============================================================================

export const PATCH = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId } = await params;

  await checkProjectAccess(user, projectId, "project:write");

  const bodyValidation = await validateRequestBody(request, UpdateProjectSchema);
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }

  const data = bodyValidation.data;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    return ApiErrors.notFound("Project");
  }

  // Check slug uniqueness if changing
  if (data.slug && data.slug !== project.slug) {
    const existing = await db.query.projects.findFirst({
      where: eq(projects.slug, data.slug),
    });
    if (existing) {
      return createErrorResponse("Project slug already exists", "CONFLICT", { slug: data.slug }, 409);
    }
  }

  const [updatedProject] = await db
    .update(projects)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning();

  revalidatePath("/dashboard");

  return createSuccessResponse(updatedProject);
});

// ============================================================================
// DELETE /api/projects/[projectId] - Delete project (owner only)
// ============================================================================

export const DELETE = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId } = await params;

  await checkProjectAccess(user, projectId);
  authorizeRole(user, "owner");

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    return ApiErrors.notFound("Project");
  }

  // Soft delete by updating status (or hard delete if preferred)
  await db.delete(projects).where(eq(projects.id, projectId));

  revalidatePath("/dashboard");

  return createSuccessResponse({ message: "Project deleted successfully" });
});