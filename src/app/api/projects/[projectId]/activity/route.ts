import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { activityLogs, projects } from "@/lib/db/schema";
import { eq, and, desc, gte, lt } from "drizzle-orm";
import { z } from "zod";
import {
  createSuccessResponse,
  createErrorResponse,
  validateQueryParams,
  validateRequestBody,
  withErrorHandling,
  ApiErrors,
} from "@/lib/api/errors";
import { getCurrentUser, authorize } from "@/lib/auth/rbac";

// ============================================================================
// Schemas
// ============================================================================

const VALID_ENVIRONMENTS = ["development", "staging", "production"] as const;
const ACTIVITY_ACTIONS = [
  "SECRET_CREATED",
  "SECRET_READ",
  "SECRET_UPDATED",
  "SECRET_DELETED",
  "SECRET_ROLLBACK",
  "ENV_SYNC",
  "AGENT_TOKEN_ISSUED",
  "AGENT_ACCESS_GRANTED",
  "AGENT_KILLSWITCH_TRIGGERED",
  "KEY_ROTATION",
  "MFA_ENABLED",
  "MFA_DISABLED",
] as const;

const ListActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  action: z.enum(ACTIVITY_ACTIONS).optional(),
  environment: z.enum(VALID_ENVIRONMENTS).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const ExportActivityQuerySchema = z.object({
  format: z.enum(["json", "csv"]).default("json"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
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
// GET /api/projects/[projectId]/activity - List activity logs
// ============================================================================

export const GET = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId } = await params;

  await checkProjectAccess(user, projectId, "audit:read");

  const { searchParams } = new URL(request.url);
  const queryValidation = validateQueryParams(searchParams, ListActivityQuerySchema);
  if (!queryValidation.success) {
    return queryValidation.response;
  }

  const { limit, offset, action, environment, startDate, endDate } = queryValidation.data;

  const whereConditions = [eq(activityLogs.projectId, projectId)];

  if (action) whereConditions.push(eq(activityLogs.action, action));
  if (environment) whereConditions.push(eq(activityLogs.environment, environment));
  if (startDate) whereConditions.push(gte(activityLogs.createdAt, new Date(startDate)));
  if (endDate) whereConditions.push(lt(activityLogs.createdAt, new Date(endDate)));

  const logs = await db.query.activityLogs.findMany({
    where: and(...whereConditions),
    orderBy: (activityLogs, { desc }) => [desc(activityLogs.createdAt)],
    limit,
    offset,
  });

  const total = await db.$count(activityLogs, and(...whereConditions));

  return createSuccessResponse(logs, { limit, offset, total });
});

// ============================================================================
// GET /api/projects/[projectId]/activity/export - Export activity logs
// ============================================================================

export const POST = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const user = await getCurrentUser();
  const { projectId } = await params;

  await checkProjectAccess(user, projectId, "audit:export");

  const bodyValidation = await validateRequestBody(request, ExportActivityQuerySchema);
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }

  const { format, startDate, endDate } = bodyValidation.data;

  const whereConditions = [eq(activityLogs.projectId, projectId)];

  if (startDate) whereConditions.push(gte(activityLogs.createdAt, new Date(startDate)));
  if (endDate) whereConditions.push(lt(activityLogs.createdAt, new Date(endDate)));

  const logs = await db.query.activityLogs.findMany({
    where: and(...whereConditions),
    orderBy: (activityLogs, { desc }) => [desc(activityLogs.createdAt)],
  });

  if (format === "csv") {
    const headers = [
      "ID",
      "Timestamp",
      "User Name",
      "User Email",
      "Action",
      "Resource",
      "Environment",
      "Details",
      "IP Address",
    ];
    const rows = logs.map((log) => [
      log.id,
      log.createdAt.toISOString(),
      log.userName,
      log.userEmail,
      log.action,
      log.resourceName,
      log.environment,
      log.details.replace(/"/g, '""'),
      log.ipAddress,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join(
      "\n"
    );

    return createSuccessResponse(
      csv,
      { format: "csv", count: logs.length },
      200
    );
  }

  return createSuccessResponse(logs, { format: "json", count: logs.length });
});