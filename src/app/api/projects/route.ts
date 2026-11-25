import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  createSuccessResponse,
  createErrorResponse,
  validateRequestBody,
  validateQueryParams,
  withErrorHandling,
} from "@/lib/api/errors";
import { getCurrentUser, authorize } from "@/lib/auth/rbac";
import { revalidatePath } from "next/cache";

// ============================================================================
// Schemas
// ============================================================================

const CreateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(50, "Slug must be at most 50 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  description: z.string().max(500).optional(),
  encryptionAlgorithm: z.string().default("AES-256-GCM"),
  environments: z
    .array(z.enum(["development", "staging", "production"]))
    .default(["development", "staging", "production"]),
});

const ListProjectsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// ============================================================================
// GET /api/projects - List projects
// ============================================================================

export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await getCurrentUser();

  if (!user) {
    return createErrorResponse("Unauthorized", "UNAUTHORIZED", undefined, 401);
  }

  const { searchParams } = new URL(request.url);
  const queryValidation = validateQueryParams(searchParams, ListProjectsQuerySchema);

  if (!queryValidation.success) {
    return queryValidation.response;
  }

  const { limit, offset } = queryValidation.data;

  // For non-owners, only show projects they're a member of
  let projectList: typeof projects.$inferSelect[] = [];
  if (user.role === "owner") {
    projectList = await db.query.projects.findMany({
      orderBy: (projects, { desc }) => [desc(projects.createdAt)],
      limit,
      offset,
    });
  } else if (user.projectId) {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, user.projectId),
    });
    projectList = project ? [project] : [];
  }

  return createSuccessResponse(projectList, { limit, offset, total: projectList.length });
});

// ============================================================================
// POST /api/projects - Create project
// ============================================================================

export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await getCurrentUser();

  if (!user) {
    return createErrorResponse("Unauthorized", "UNAUTHORIZED", undefined, 401);
  }

  const bodyValidation = await validateRequestBody(request, CreateProjectSchema);
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }

  const data = bodyValidation.data;

  // Check if slug is unique
  const existing = await db.query.projects.findFirst({
    where: eq(projects.slug, data.slug),
  });

  if (existing) {
    return createErrorResponse("Project slug already exists", "CONFLICT", { slug: data.slug }, 409);
  }

  const [project] = await db
    .insert(projects)
    .values({
      id: randomUUID(),
      name: data.name,
      slug: data.slug,
      description: data.description || "",
      encryptionAlgorithm: data.encryptionAlgorithm,
      environments: data.environments,
    })
    .returning();

  revalidatePath("/dashboard");

  return createSuccessResponse(project, {}, 201);
});