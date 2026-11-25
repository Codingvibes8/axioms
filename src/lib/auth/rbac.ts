import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { teamMembers, agentHarnesses, projects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export type RoleType = "owner" | "admin" | "developer" | "viewer" | "agent";

export interface AuthUser {
  userId: string;
  email: string;
  role: RoleType;
  projectId: string | null;
  permissions: string[];
}

/**
 * Role hierarchy for RBAC checks
 */
const ROLE_HIERARCHY: Record<RoleType, number> = {
  viewer: 1,
  developer: 2,
  admin: 3,
  owner: 4,
  agent: 0, // Agents have special handling
};

/**
 * Permission definitions
 */
export const PERMISSIONS = {
  // Project permissions
  "project:read": ["owner", "admin", "developer", "viewer"],
  "project:write": ["owner", "admin", "developer"],
  "project:delete": ["owner"],
  "project:settings": ["owner", "admin"],

  // Secret permissions
  "secret:read": ["owner", "admin", "developer", "viewer"],
  "secret:write": ["owner", "admin", "developer"],
  "secret:delete": ["owner", "admin"],
  "secret:rotate": ["owner", "admin", "developer"],
  "secret:rollback": ["owner", "admin"],

  // Agent permissions
  "agent:read": ["owner", "admin", "developer", "viewer"],
  "agent:write": ["owner", "admin", "developer"],
  "agent:delete": ["owner", "admin"],
  "agent:invoke": ["owner", "admin", "developer", "agent"],
  "agent:manage_secrets": ["owner", "admin"],

  // Environment permissions
  "environment:manage": ["owner", "admin"],
  "environment:deploy": ["owner", "admin", "developer"],

  // Audit permissions
  "audit:read": ["owner", "admin"],
  "audit:export": ["owner", "admin"],

  // Team permissions
  "team:manage": ["owner", "admin"],
  "team:invite": ["owner", "admin"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Gets the current authenticated user from Clerk session
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const { userId, orgId } = await auth();

  if (!userId) {
    return null;
  }

  // Get user's email from Clerk (would need to be fetched from Clerk API in real app)
  // For now, we'll use a placeholder
  const email = `user_${userId}@clerk.local`;

  // If user has an orgId, check their team membership
  if (orgId) {
    const membership = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.projectId, orgId),
        eq(teamMembers.userId, userId)
      ),
    });

    if (membership) {
      return {
        userId,
        email,
        role: membership.role,
        projectId: orgId,
        permissions: getPermissionsForRole(membership.role),
      };
    }
  }

  // Fallback: check if user owns any projects
  const ownedProject = await db.query.projects.findFirst({
    where: eq(projects.id, orgId || ""),
  });

  if (ownedProject) {
    return {
      userId,
      email,
      role: "owner",
      projectId: ownedProject.id,
      permissions: getPermissionsForRole("owner"),
    };
  }

  // Default minimal access
  return {
    userId,
    email,
    role: "viewer",
    projectId: null,
    permissions: getPermissionsForRole("viewer"),
  };
}

/**
 * Gets permissions for a given role
 */
export function getPermissionsForRole(role: RoleType): string[] {
  const permissions: string[] = [];

  for (const [permission, allowedRoles] of Object.entries(PERMISSIONS)) {
    // allowedRoles is a readonly tuple of role strings
    if ((allowedRoles as readonly string[]).includes(role)) {
      permissions.push(permission);
    }
  }

  return permissions;
}

/**
 * Checks if a user's role meets or exceeds the required role
 */
export function hasRole(userRole: RoleType, requiredRole: RoleType): boolean {
  if (userRole === "agent") return false; // Agents use permission-based checks
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
}

/**
 * Checks if a user has a specific permission
 */
export function hasPermission(user: AuthUser | null, permission: Permission): boolean {
  if (!user) return false;

  // Owner has all permissions
  if (user.role === "owner") return true;

  // Check explicit permission
  return user.permissions.includes(permission);
}

/**
 * Authorization guard for Server Actions and API routes
 */
export function authorize(user: AuthUser | null, permission: Permission): void {
  if (!hasPermission(user, permission)) {
    throw new Error(
      `Forbidden: Required permission "${permission}" not granted.`
    );
  }
}

/**
 * Authorization guard for role-based access
 */
export function authorizeRole(
  user: AuthUser | null,
  requiredRole: RoleType
): void {
  if (!user || !hasRole(user.role, requiredRole)) {
    throw new Error(
      `Forbidden: Required role "${requiredRole}" or higher.`
    );
  }
}

/**
 * Gets the agent harness by token prefix for agent authentication
 */
export async function getAgentByTokenPrefix(
  tokenPrefix: string
): Promise<typeof agentHarnesses.$inferSelect | null> {
  const agent = await db.query.agentHarnesses.findFirst({
    where: eq(agentHarnesses.tokenPrefix, tokenPrefix),
  });
  return agent ?? null;
}

/**
 * Validates an agent token
 */
export async function validateAgentToken(
  fullToken: string
): Promise<typeof agentHarnesses.$inferSelect | null> {
  // Token format: prefix_randomstring
  const parts = fullToken.split("_");
  if (parts.length < 2) return null;

  const prefix = parts[0];
  const agent = await getAgentByTokenPrefix(prefix);

  if (!agent || agent.status !== "active") return null;

  // Verify token hash (in production, use constant-time comparison)
  const { hashToken } = await import("@/lib/crypto");
  const tokenHash = hashToken(fullToken);

  if (tokenHash !== agent.tokenHash) return null;

  return agent;
}