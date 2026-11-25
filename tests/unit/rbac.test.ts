import { describe, it, expect } from "vitest";

type Role = "owner" | "admin" | "developer" | "viewer" | "agent";
type Permission = 
  | "secret:read" | "secret:write" | "secret:delete" | "secret:rotate" | "secret:rollback"
  | "agent:read" | "agent:write" | "agent:delete" | "agent:invoke" | "agent:manage_secrets"
  | "environment:manage" | "environment:deploy"
  | "audit:read" | "audit:export"
  | "team:manage" | "team:invite"
  | "project:read" | "project:write" | "project:delete" | "project:settings";

const ROLE_HIERARCHY: Record<Role, number> = {
  viewer: 1,
  developer: 2,
  admin: 3,
  owner: 4,
  agent: 0,
};

const PERMISSIONS: Record<Permission, Role[]> = {
  "project:read": ["owner", "admin", "developer", "viewer"],
  "project:write": ["owner", "admin", "developer"],
  "project:delete": ["owner"],
  "project:settings": ["owner", "admin"],
  "secret:read": ["owner", "admin", "developer", "viewer"],
  "secret:write": ["owner", "admin", "developer"],
  "secret:delete": ["owner", "admin"],
  "secret:rotate": ["owner", "admin", "developer"],
  "secret:rollback": ["owner", "admin"],
  "agent:read": ["owner", "admin", "developer", "viewer"],
  "agent:write": ["owner", "admin", "developer"],
  "agent:delete": ["owner", "admin"],
  "agent:invoke": ["owner", "admin", "developer", "agent"],
  "agent:manage_secrets": ["owner", "admin"],
  "environment:manage": ["owner", "admin"],
  "environment:deploy": ["owner", "admin", "developer"],
  "audit:read": ["owner", "admin"],
  "audit:export": ["owner", "admin"],
  "team:manage": ["owner", "admin"],
  "team:invite": ["owner", "admin"],
};

function hasRole(userRole: Role, requiredRole: Role): boolean {
  if (userRole === "agent") return false;
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
}

function hasPermission(role: Role, permission: Permission): boolean {
  if (role === "owner") return true;
  return PERMISSIONS[permission]?.includes(role) ?? false;
}

function canAccessEnvironment(userEnvs: string[], targetEnv: string): boolean {
  return userEnvs.includes(targetEnv) || userEnvs.includes("*");
}

describe("RBAC system", () => {
  describe("hasRole", () => {
    it("allows owner to access everything", () => {
      expect(hasRole("owner", "admin")).toBe(true);
      expect(hasRole("owner", "developer")).toBe(true);
      expect(hasRole("owner", "viewer")).toBe(true);
    });

    it("allows admin to access developer and viewer", () => {
      expect(hasRole("admin", "developer")).toBe(true);
      expect(hasRole("admin", "viewer")).toBe(true);
      expect(hasRole("admin", "owner")).toBe(false);
    });

    it("allows developer to access viewer", () => {
      expect(hasRole("developer", "viewer")).toBe(true);
      expect(hasRole("developer", "admin")).toBe(false);
    });

    it("denies agent role comparisons", () => {
      expect(hasRole("agent", "viewer")).toBe(false);
      expect(hasRole("agent", "owner")).toBe(false);
    });
  });

  describe("hasPermission", () => {
    it("grants owner all permissions", () => {
      const permissions: Permission[] = [
        "secret:read", "secret:write", "secret:delete", "secret:rotate", "secret:rollback",
        "agent:invoke", "agent:manage_secrets", "environment:manage", "audit:export",
        "team:manage", "project:delete",
      ];
      for (const p of permissions) {
        expect(hasPermission("owner", p)).toBe(true);
      }
    });

    it("grants developer secret:write but not secret:delete", () => {
      expect(hasPermission("developer", "secret:write")).toBe(true);
      expect(hasPermission("developer", "secret:rotate")).toBe(true);
      expect(hasPermission("developer", "secret:delete")).toBe(false);
      expect(hasPermission("developer", "secret:rollback")).toBe(false);
    });

    it("grants viewer only read permissions", () => {
      expect(hasPermission("viewer", "secret:read")).toBe(true);
      expect(hasPermission("viewer", "project:read")).toBe(true);
      expect(hasPermission("viewer", "secret:write")).toBe(false);
      expect(hasPermission("viewer", "agent:invoke")).toBe(false);
    });

    it("grants agent only agent:invoke", () => {
      expect(hasPermission("agent", "agent:invoke")).toBe(true);
      expect(hasPermission("agent", "secret:read")).toBe(false);
      expect(hasPermission("agent", "agent:read")).toBe(false);
    });

    it("grants admin most permissions except owner-only", () => {
      expect(hasPermission("admin", "secret:write")).toBe(true);
      expect(hasPermission("admin", "secret:delete")).toBe(true);
      expect(hasPermission("admin", "project:settings")).toBe(true);
      expect(hasPermission("admin", "project:delete")).toBe(false);
      expect(hasPermission("admin", "agent:manage_secrets")).toBe(true);
    });
  });

  describe("canAccessEnvironment", () => {
    it("allows access when environment in allowed list", () => {
      expect(canAccessEnvironment(["development", "staging"], "development")).toBe(true);
      expect(canAccessEnvironment(["*"], "production")).toBe(true);
    });

    it("denies access when environment not in allowed list", () => {
      expect(canAccessEnvironment(["development"], "production")).toBe(false);
      expect(canAccessEnvironment([], "staging")).toBe(false);
    });
  });
});