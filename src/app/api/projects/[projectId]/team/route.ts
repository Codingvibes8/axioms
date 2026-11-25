import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { teamMembers, projects } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  createSuccessResponse,
  createErrorResponse,
  validateRequestBody,
  validateQueryParams,
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

const AddTeamMemberSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email format"),
  role: z.enum(VALID_ROLES).default("developer"),
  allowedEnvironments: z.array(z.enum(VALID_ENVIRONMENTS)).default(["development"]),
});

const ListTeamQuerySchema = z.object({
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
// GET /api/projects/[projectId]/team - List team members
// ============================================================================

export const GET = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId } = await params;

  await checkProjectAccess(user, projectId, "team:manage");

  const { searchParams } = new URL(request.url);
  const queryValidation = validateQueryParams(searchParams, ListTeamQuerySchema);
  if (!queryValidation.success) {
    return queryValidation.response;
  }

  const { limit, offset } = queryValidation.data;

  const members = await db.query.teamMembers.findMany({
    where: eq(teamMembers.projectId, projectId),
    orderBy: (teamMembers, { desc }) => [desc(teamMembers.createdAt)],
    limit,
    offset,
  });

  const total = await db.$count(teamMembers, eq(teamMembers.projectId, projectId));

  return createSuccessResponse(members, { limit, offset, total });
});

// ============================================================================
// POST /api/projects/[projectId]/team - Add team member
// ============================================================================

export const POST = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId } = await params;

  await checkProjectAccess(user, projectId, "team:invite");

  const bodyValidation = await validateRequestBody(request, AddTeamMemberSchema);
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }

  const data = bodyValidation.data;

  // Check if user already exists in project
  const existing = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.projectId, projectId),
      eq(teamMembers.userId, data.userId)
    ),
  });

  if (existing) {
    return createErrorResponse(
      "User is already a member of this project",
      "CONFLICT",
      { userId: data.userId },
      409
    );
  }

  // Cannot add owner if one already exists (unless you're the owner)
  if (data.role === "owner") {
    const existingOwner = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.projectId, projectId),
        eq(teamMembers.role, "owner")
      ),
    });
    if (existingOwner && user?.role !== "owner") {
      return createErrorResponse("Project already has an owner", "CONFLICT", undefined, 409);
    }
  }

  const [member] = await db
    .insert(teamMembers)
    .values({
      id: randomUUID(),
      projectId,
      userId: data.userId,
      name: data.name,
      email: data.email,
      role: data.role,
      allowedEnvironments: data.allowedEnvironments,
    })
    .returning();

  revalidatePath("/dashboard");

  return createSuccessResponse(member, {}, 201);
});