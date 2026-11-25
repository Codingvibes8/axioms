"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import {
  activityLogs,
  agentHarnesses,
  projectSettings,
  projects,
  secretVersions,
  secrets,
  teamMembers,
} from "@/lib/db/schema";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import {
  authorize,
  authorizeRole,
  getCurrentUser,
  hasPermission,
} from "@/lib/auth/rbac";
import {
  decryptData,
  encryptData,
  generateSecureToken,
  getTokenSuffix,
  hashToken,
} from "@/lib/crypto";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

// ============================================================================
// Types & Constants
// ============================================================================

const VALID_ENVIRONMENTS = ["development", "staging", "production"] as const;
type Environment = (typeof VALID_ENVIRONMENTS)[number];

const VALID_ROLES = ["owner", "admin", "developer", "viewer", "agent"] as const;
type RoleType = (typeof VALID_ROLES)[number];

const VALID_AGENT_STATUSES = [
  "active",
  "sandboxed",
  "revoked",
  "rate_limited",
] as const;
type AgentStatus = (typeof VALID_AGENT_STATUSES)[number];

const VALID_MEMBER_ROLES = ["owner", "admin", "developer", "viewer", "agent"] as const;
type MemberRole = (typeof VALID_MEMBER_ROLES)[number];

const VALID_CATEGORIES = [
  "API Key",
  "Database",
  "OAuth",
  "AI / LLM",
  "Cloud",
  "Infra",
  "General",
] as const;
type SecretCategory = (typeof VALID_CATEGORIES)[number];

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

// ============================================================================
// Zod Schemas
// ============================================================================

const ProjectIdSchema = z.object({
  projectId: z.string().uuid("Invalid Project ID format"),
});

const ProjectSlugSchema = z.object({
  slug: z.string().min(1, "Slug is required"),
});

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
    .array(z.enum(VALID_ENVIRONMENTS))
    .default(["development", "staging", "production"]),
});

const UpdateProjectSchema = CreateProjectSchema.partial().extend({
  projectId: z.string().uuid("Invalid Project ID format"),
});

const SecretBaseSchema = z.object({
  projectId: z.string().uuid("Invalid Project ID format"),
  key: z.string().min(1, "Secret key is required").max(100),
  environment: z.enum(VALID_ENVIRONMENTS).default("development"),
  category: z.enum(VALID_CATEGORIES).default("General"),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).default([]),
  isEphemeral: z.boolean().default(false),
  expiresAt: z.string().datetime().optional().nullable(),
});

const CreateSecretSchema = SecretBaseSchema.extend({
  value: z.string().min(1, "Secret value is required"),
});

const UpdateSecretSchema = SecretBaseSchema.partial().extend({
  secretId: z.string().uuid("Invalid Secret ID format"),
  value: z.string().min(1, "Secret value is required").optional(),
  version: z.number().int().positive().optional(),
});

const GetSecretSchema = z.object({
  secretId: z.string().uuid("Invalid Secret ID format"),
});

const RollbackSecretSchema = z.object({
  secretId: z.string().uuid("Invalid Secret ID format"),
  targetVersion: z.number().int().positive("Target version must be positive"),
});

const SyncSecretToEnvSchema = z.object({
  secretId: z.string().uuid("Invalid Secret ID format"),
  targetEnvironment: z.enum(VALID_ENVIRONMENTS),
});

const SyncEnvBatchSchema = z.object({
  projectId: z.string().uuid("Invalid Project ID format"),
  sourceEnvironment: z.enum(VALID_ENVIRONMENTS),
  targetEnvironment: z.enum(VALID_ENVIRONMENTS),
  secretKeys: z.array(z.string()).optional(),
  overwrite: z.boolean().default(false),
});

const BulkImportSecretsSchema = z.object({
  projectId: z.string().uuid("Invalid Project ID format"),
  environment: z.enum(VALID_ENVIRONMENTS),
  secrets: z.array(
    z.object({
      key: z.string().min(1).max(100),
      value: z.string().min(1),
      category: z.enum(VALID_CATEGORIES).default("General"),
      description: z.string().max(500).optional(),
      tags: z.array(z.string()).default([]),
      isEphemeral: z.boolean().default(false),
      expiresAt: z.string().datetime().optional().nullable(),
    })
  ),
});

const TeamMemberBaseSchema = z.object({
  projectId: z.string().uuid("Invalid Project ID format"),
  userId: z.string().min(1, "User ID is required"),
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email format"),
  role: z.enum(VALID_MEMBER_ROLES).default("developer"),
  allowedEnvironments: z.array(z.enum(VALID_ENVIRONMENTS)).default(["development"]),
});

const AddTeamMemberSchema = TeamMemberBaseSchema;

const UpdateTeamMemberSchema = z.object({
  memberId: z.string().uuid("Invalid Member ID format"),
  role: z.enum(VALID_MEMBER_ROLES).optional(),
  allowedEnvironments: z.array(z.enum(VALID_ENVIRONMENTS)).optional(),
});

const RemoveTeamMemberSchema = z.object({
  memberId: z.string().uuid("Invalid Member ID format"),
});

const AgentHarnessBaseSchema = z.object({
  projectId: z.string().uuid("Invalid Project ID format"),
  name: z.string().min(1, "Agent name is required").max(100),
  description: z.string().max(500).optional(),
  modelProvider: z
    .enum(["OpenAI", "Anthropic", "Google Gemini", "DeepSeek", "Custom LLM"])
    .default("Anthropic"),
  agentType: z
    .enum([
      "Autonomous Agent",
      "Coding Assistant",
      "CI/CD Pipeline",
      "Data Extractor",
      "Customer Support Bot",
    ])
    .default("Coding Assistant"),
  allowedSecrets: z.array(z.string().uuid()).default([]),
  environment: z.enum(VALID_ENVIRONMENTS).default("development"),
  ephemeralTtlMinutes: z.number().int().min(5).max(10080).default(60),
  tokenLimitPerHour: z.number().int().min(1000).max(1000000).default(50000),
  autoMaskSecrets: z.boolean().default(true),
});

const CreateAgentHarnessSchema = AgentHarnessBaseSchema;

const UpdateAgentHarnessSchema = AgentHarnessBaseSchema.partial().extend({
  agentId: z.string().uuid("Invalid Agent ID format"),
  status: z.enum(VALID_AGENT_STATUSES).optional(),
});

const UpdateAgentStatusSchema = z.object({
  agentId: z.string().uuid("Invalid Agent ID format"),
  status: z.enum(VALID_AGENT_STATUSES),
});

const TriggerKillSwitchSchema = z.object({
  agentId: z.string().uuid("Invalid Agent ID format"),
  reason: z.string().max(500).optional(),
});

const RotateAgentTokenSchema = z.object({
  agentId: z.string().uuid("Invalid Agent ID format"),
});

const ExtendAgentTTLSchema = z.object({
  agentId: z.string().uuid("Invalid Agent ID format"),
  additionalMinutes: z.number().int().min(1).max(10080),
});

const GetActivityLogsSchema = z.object({
  projectId: z.string().uuid("Invalid Project ID format"),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
  action: z.enum(ACTIVITY_ACTIONS).optional(),
  environment: z.enum(VALID_ENVIRONMENTS).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const ExportActivityLogsSchema = z.object({
  projectId: z.string().uuid("Invalid Project ID format"),
  format: z.enum(["json", "csv"]).default("json"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const UpdateProjectSettingsSchema = z.object({
  projectId: z.string().uuid("Invalid Project ID format"),
  autoBackupEnabled: z.boolean().optional(),
  slackWebhookUrl: z.string().url().optional().nullable().transform((v) => v ?? undefined),
  discordWebhookUrl: z.string().url().optional().nullable().transform((v) => v ?? undefined),
  pagerdutyKey: z.string().optional().nullable().transform((v) => v ?? undefined),
  requireMfaForProduction: z.boolean().optional(),
  enableAgentProxyFirewall: z.boolean().optional(),
  auditRetentionDays: z.number().int().min(1).max(3650).optional(),
});

const RotateMasterKeySchema = z.object({
  projectId: z.string().uuid("Invalid Project ID format"),
  confirm: z.literal(true),
});

const ResetProjectToSeedSchema = z.object({
  projectId: z.string().uuid("Invalid Project ID format"),
  confirm: z.literal(true),
  ownerClerkUserId: z.string().optional(),
  ownerName: z.string().optional(),
  ownerEmail: z.string().email().optional(),
});

// ============================================================================
// Helper Functions
// ============================================================================

async function logActivity(
  projectId: string,
  userId: string,
  userEmail: string,
  action: string,
  resourceName: string,
  environment: Environment = "production",
  details: string = ""
) {
  await db.insert(activityLogs).values({
    id: randomUUID(),
    projectId,
    userName: userId,
    userEmail,
    action,
    resourceName,
    environment,
    details,
  });
}

function generateAgentToken(prefix: string = "axm"): {
  fullToken: string;
  tokenHash: string;
  tokenLastFour: string;
} {
  const randomPart = generateSecureToken(24);
  const fullToken = `${prefix}_${randomPart}`;
  const tokenHash = hashToken(fullToken);
  const tokenLastFour = getTokenSuffix(fullToken);
  return { fullToken, tokenHash, tokenLastFour };
}

async function checkProjectAccess(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  projectId: string,
  requiredPermission?: string
): Promise<void> {
  if (!user) throw new Error("Unauthorized");
  if (user.role !== "owner" && user.projectId !== projectId) {
    throw new Error("Access denied to this project");
  }
  if (requiredPermission) {
    authorize(user, requiredPermission as any);
  }
}

async function createSecretVersion(
  secretId: string,
  value: string,
  comment: string,
  createdBy: string
) {
  const secret = await db.query.secrets.findFirst({
    where: eq(secrets.id, secretId),
  });
  if (!secret) throw new Error("Secret not found");

  const newVersion = secret.version + 1;
  const encryptedValue = encryptData(value);

  await db.transaction(async (tx) => {
    await tx.insert(secretVersions).values({
      id: `${secretId}_v${newVersion}`,
      secretId,
      version: newVersion,
      value: encryptedValue,
      comment,
      createdBy,
    });

    await tx
      .update(secrets)
      .set({
        value: encryptedValue,
        version: newVersion,
        lastRotatedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: createdBy,
      })
      .where(eq(secrets.id, secretId));
  });
}

// ============================================================================
// Project Actions
// ============================================================================

/**
 * Gets the current project based on user's organization/context
 */
export async function getCurrentProject() {
  const user = await getCurrentUser();

  if (!user || !user.projectId) {
    return { success: false, error: "No current project found" };
  }

  try {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, user.projectId),
    });

    if (!project) {
      return { success: false, error: "Project not found" };
    }

    return { success: true, data: project };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch project",
    };
  }
}

/**
 * Gets a project by ID
 */
export async function getProjectById(input: z.infer<typeof ProjectIdSchema>) {
  const user = await getCurrentUser();

  const parsed = ProjectIdSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  try {
    await checkProjectAccess(user, parsed.data.projectId, "project:read");

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, parsed.data.projectId),
    });

    if (!project) {
      return { success: false, error: "Project not found" };
    }

    return { success: true, data: project };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch project",
    };
  }
}

/**
 * Creates a new project
 */
export async function createProject(input: z.infer<typeof CreateProjectSchema>) {
  const user = await getCurrentUser();

  const parsed = CreateProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const data = parsed.data;

  try {
    // Check if slug is unique
    const existing = await db.query.projects.findFirst({
      where: eq(projects.slug, data.slug),
    });

    if (existing) {
      return { success: false, error: "Project slug already exists" };
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

    // Create default project settings
    await db.insert(projectSettings).values({
      projectId: project.id,
    });

    // Add creator as owner
    await db.insert(teamMembers).values({
      id: randomUUID(),
      projectId: project.id,
      userId: user.userId,
      name: user.email.split("@")[0],
      email: user.email,
      role: "owner",
      allowedEnvironments: data.environments,
    });

    await logActivity(
      project.id,
      user.userId,
      user.email,
      "SECRET_CREATED", // Using closest available action
      project.name,
      "production",
      `Created project ${project.name} (${project.slug})`
    );

    revalidatePath("/dashboard");

    return { success: true, data: project };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create project",
    };
  }
}

/**
 * Updates a project
 */
export async function updateProject(input: z.infer<typeof UpdateProjectSchema>) {
  const user = await getCurrentUser();

  const parsed = UpdateProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  const { projectId, ...updateData } = parsed.data;

  try {
    await checkProjectAccess(user, projectId, "project:write");

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return { success: false, error: "Project not found" };
    }

    // Check slug uniqueness if changing
    if (updateData.slug && updateData.slug !== project.slug) {
      const existing = await db.query.projects.findFirst({
        where: eq(projects.slug, updateData.slug),
      });
      if (existing) {
        return { success: false, error: "Project slug already exists" };
      }
    }

    const [updatedProject] = await db
      .update(projects)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning();

    await logActivity(
      projectId,
      user!.userId,
      user!.email,
      "SECRET_UPDATED",
      updatedProject.name,
      "production",
      `Updated project configuration`
    );

    revalidatePath("/dashboard");

    return { success: true, data: updatedProject };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update project",
    };
  }
}

// ============================================================================
// Secret Actions
// ============================================================================

/**
 * Gets all secrets for a project (with optional environment filter)
 */
export async function getSecrets(input: {
  projectId: string;
  environment?: Environment;
}) {
  const user = await getCurrentUser();

  const parsed = z
    .object({
      projectId: z.string().uuid(),
      environment: z.enum(VALID_ENVIRONMENTS).optional(),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  try {
    await checkProjectAccess(user, parsed.data.projectId, "secret:read");

    const whereConditions = [eq(secrets.projectId, parsed.data.projectId)];
    if (parsed.data.environment) {
      whereConditions.push(eq(secrets.environment, parsed.data.environment));
    }

    const secretList = await db.query.secrets.findMany({
      where: and(...whereConditions),
      orderBy: (secrets, { desc }) => [desc(secrets.updatedAt)],
    });

    // Mask sensitive values for non-owner/admin
    const canViewValues = user?.role === "owner" || user?.role === "admin";
    const safeSecrets = secretList.map((s) => ({
      ...s,
      value: canViewValues ? s.value : "[ENCRYPTED]",
    }));

    return { success: true, data: safeSecrets };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch secrets",
    };
  }
}

/**
 * Gets a single secret by ID
 */
export async function getSecretById(input: z.infer<typeof GetSecretSchema>) {
  const user = await getCurrentUser();

  const parsed = GetSecretSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  try {
    const secret = await db.query.secrets.findFirst({
      where: eq(secrets.id, parsed.data.secretId),
    });

    if (!secret) {
      return { success: false, error: "Secret not found" };
    }

    await checkProjectAccess(user, secret.projectId, "secret:read");

    const canViewValue = user?.role === "owner" || user?.role === "admin";

    await logActivity(
      secret.projectId,
      user!.userId,
      user!.email,
      "SECRET_READ",
      secret.key,
      secret.environment,
      "Viewed secret value"
    );

    return {
      success: true,
      data: {
        ...secret,
        value: canViewValue ? secret.value : "[ENCRYPTED]",
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch secret",
    };
  }
}

/**
 * Creates a new secret
 */
export async function createSecret(input: z.infer<typeof CreateSecretSchema>) {
  const user = await getCurrentUser();

  const parsed = CreateSecretSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  const data = parsed.data;

  try {
    await checkProjectAccess(user, data.projectId, "secret:write");

    // Check for duplicate key in same environment
    const existing = await db.query.secrets.findFirst({
      where: and(
        eq(secrets.projectId, data.projectId),
        eq(secrets.key, data.key),
        eq(secrets.environment, data.environment)
      ),
    });

    if (existing) {
      return {
        success: false,
        error: `Secret with key "${data.key}" already exists in ${data.environment} environment`,
      };
    }

    const encryptedValue = encryptData(data.value);

    const [secret] = await db
      .insert(secrets)
      .values({
        id: randomUUID(),
        projectId: data.projectId,
        key: data.key,
        value: encryptedValue,
        environment: data.environment,
        category: data.category,
        description: data.description || "",
        tags: data.tags,
        isEphemeral: data.isEphemeral,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        updatedBy: user!.email,
      })
      .returning();

    // Create initial version
    await db.insert(secretVersions).values({
      id: `${secret.id}_v1`,
      secretId: secret.id,
      version: 1,
      value: encryptedValue,
      comment: "Initial version",
      createdBy: user!.email,
    });

    await logActivity(
      data.projectId,
      user!.userId,
      user!.email,
      "SECRET_CREATED",
      data.key,
      data.environment,
      `Created secret in ${data.category} category`
    );

    revalidatePath("/dashboard");

    return { success: true, data: { ...secret, value: "[ENCRYPTED]" } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create secret",
    };
  }
}

/**
 * Updates a secret (creates new version)
 */
export async function updateSecret(input: z.infer<typeof UpdateSecretSchema>) {
  const user = await getCurrentUser();

  const parsed = UpdateSecretSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  const { secretId, value, version, ...updateData } = parsed.data;

  try {
    const secret = await db.query.secrets.findFirst({
      where: eq(secrets.id, secretId),
    });

    if (!secret) {
      return { success: false, error: "Secret not found" };
    }

    await checkProjectAccess(user, secret.projectId, "secret:write");

    // If version is provided, verify it matches current version (optimistic locking)
    if (version && version !== secret.version) {
      return {
        success: false,
        error: "Version conflict: secret has been modified by another user",
      };
    }

    const updatePayload: any = {
      ...updateData,
      updatedAt: new Date(),
      updatedBy: user!.email,
    };

    if (value) {
      updatePayload.value = encryptData(value);
      updatePayload.lastRotatedAt = new Date();
    }

    const [updatedSecret] = await db
      .update(secrets)
      .set(updatePayload)
      .where(eq(secrets.id, secretId))
      .returning();

    // If value changed, create new version
    if (value) {
      await createSecretVersion(
        secretId,
        value,
        "Updated via dashboard",
        user!.email
      );
    }

    await logActivity(
      secret.projectId,
      user!.userId,
      user!.email,
      value ? "SECRET_UPDATED" : "SECRET_READ",
      secret.key,
      secret.environment,
      value ? "Updated secret value and rotated version" : "Updated secret metadata"
    );

    revalidatePath("/dashboard");

    return { success: true, data: { ...updatedSecret, value: "[ENCRYPTED]" } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update secret",
    };
  }
}

/**
 * Deletes a secret
 */
export async function deleteSecret(input: z.infer<typeof GetSecretSchema>) {
  const user = await getCurrentUser();

  const parsed = GetSecretSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  try {
    const secret = await db.query.secrets.findFirst({
      where: eq(secrets.id, parsed.data.secretId),
    });

    if (!secret) {
      return { success: false, error: "Secret not found" };
    }

    await checkProjectAccess(user, secret.projectId, "secret:delete");

    await db.delete(secrets).where(eq(secrets.id, secret.id));

    await logActivity(
      secret.projectId,
      user!.userId,
      user!.email,
      "SECRET_DELETED",
      secret.key,
      secret.environment,
      `Deleted secret`
    );

    revalidatePath("/dashboard");

    return { success: true, message: "Secret deleted successfully" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete secret",
    };
  }
}

/**
 * Rolls back a secret to a previous version
 */
export async function rollbackSecret(input: z.infer<typeof RollbackSecretSchema>) {
  const user = await getCurrentUser();

  const parsed = RollbackSecretSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  try {
    const secret = await db.query.secrets.findFirst({
      where: eq(secrets.id, parsed.data.secretId),
    });

    if (!secret) {
      return { success: false, error: "Secret not found" };
    }

    await checkProjectAccess(user, secret.projectId, "secret:rollback");

    if (parsed.data.targetVersion >= secret.version) {
      return {
        success: false,
        error: "Target version must be less than current version",
      };
    }

    const targetVersion = await db.query.secretVersions.findFirst({
      where: and(
        eq(secretVersions.secretId, secret.id),
        eq(secretVersions.version, parsed.data.targetVersion)
      ),
    });

    if (!targetVersion) {
      return { success: false, error: "Target version not found" };
    }

    const newVersion = secret.version + 1;

    await db.transaction(async (tx) => {
      await tx.insert(secretVersions).values({
        id: `${secret.id}_v${newVersion}`,
        secretId: secret.id,
        version: newVersion,
        value: targetVersion.value,
        comment: `Rolled back to version ${parsed.data.targetVersion}`,
        createdBy: user!.email,
      });

      await tx
        .update(secrets)
        .set({
          value: targetVersion.value,
          version: newVersion,
          lastRotatedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: user!.email,
        })
        .where(eq(secrets.id, secret.id));
    });

    await logActivity(
      secret.projectId,
      user!.userId,
      user!.email,
      "SECRET_ROLLBACK",
      secret.key,
      secret.environment,
      `Rolled back from v${secret.version} to v${parsed.data.targetVersion} (new version: ${newVersion})`
    );

    revalidatePath("/dashboard");

    return { success: true, message: "Secret rolled back successfully" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to rollback secret",
    };
  }
}

/**
 * Gets all versions of a secret
 */
export async function getSecretVersions(input: z.infer<typeof GetSecretSchema>) {
  const user = await getCurrentUser();

  const parsed = GetSecretSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  try {
    const secret = await db.query.secrets.findFirst({
      where: eq(secrets.id, parsed.data.secretId),
    });

    if (!secret) {
      return { success: false, error: "Secret not found" };
    }

    await checkProjectAccess(user, secret.projectId, "secret:read");

    const versions = await db.query.secretVersions.findMany({
      where: eq(secretVersions.secretId, secret.id),
      orderBy: (secretVersions, { desc }) => [desc(secretVersions.version)],
    });

    // Mask values for non-owner/admin
    const canViewValues = user?.role === "owner" || user?.role === "admin";
    const safeVersions = versions.map((v) => ({
      ...v,
      value: canViewValues ? v.value : "[ENCRYPTED]",
    }));

    return { success: true, data: safeVersions };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch secret versions",
    };
  }
}

/**
 * Syncs a single secret to another environment
 */
export async function syncSecretToEnv(input: z.infer<typeof SyncSecretToEnvSchema>) {
  const user = await getCurrentUser();

  const parsed = SyncSecretToEnvSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  try {
    const secret = await db.query.secrets.findFirst({
      where: eq(secrets.id, parsed.data.secretId),
    });

    if (!secret) {
      return { success: false, error: "Secret not found" };
    }

    await checkProjectAccess(user, secret.projectId, "secret:write");

    // Check if secret already exists in target environment
    const existing = await db.query.secrets.findFirst({
      where: and(
        eq(secrets.projectId, secret.projectId),
        eq(secrets.key, secret.key),
        eq(secrets.environment, parsed.data.targetEnvironment)
      ),
    });

    if (existing) {
      return {
        success: false,
        error: `Secret "${secret.key}" already exists in ${parsed.data.targetEnvironment} environment`,
      };
    }

    const [newSecret] = await db
      .insert(secrets)
      .values({
        id: randomUUID(),
        projectId: secret.projectId,
        key: secret.key,
        value: secret.value,
        environment: parsed.data.targetEnvironment,
        category: secret.category,
        description: secret.description,
        tags: secret.tags,
        version: 1,
        isEphemeral: secret.isEphemeral,
        expiresAt: secret.expiresAt,
        updatedBy: user!.email,
      })
      .returning();

    await db.insert(secretVersions).values({
      id: `${newSecret.id}_v1`,
      secretId: newSecret.id,
      version: 1,
      value: secret.value,
      comment: `Synced from ${secret.environment} environment`,
      createdBy: user!.email,
    });

    await logActivity(
      secret.projectId,
      user!.userId,
      user!.email,
      "ENV_SYNC",
      `${secret.key} (${secret.environment} -> ${parsed.data.targetEnvironment})`,
      parsed.data.targetEnvironment,
      `Synced secret to ${parsed.data.targetEnvironment}`
    );

    revalidatePath("/dashboard");

    return { success: true, data: { ...newSecret, value: "[ENCRYPTED]" } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to sync secret",
    };
  }
}

/**
 * Batch syncs secrets between environments
 */
export async function syncEnvBatch(input: z.infer<typeof SyncEnvBatchSchema>) {
  const user = await getCurrentUser();

  const parsed = SyncEnvBatchSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  if (parsed.data.sourceEnvironment === parsed.data.targetEnvironment) {
    return { success: false, error: "Source and target environments must be different" };
  }

  try {
    await checkProjectAccess(user, parsed.data.projectId, "secret:write");

    const whereConditions = [
      eq(secrets.projectId, parsed.data.projectId),
      eq(secrets.environment, parsed.data.sourceEnvironment),
    ];

    if (parsed.data.secretKeys && parsed.data.secretKeys.length > 0) {
      whereConditions.push(sql`${secrets.key} = ANY(${parsed.data.secretKeys})`);
    }

    const sourceSecrets = await db.query.secrets.findMany({
      where: and(...whereConditions),
    });

    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const secret of sourceSecrets) {
      try {
        const existing = await db.query.secrets.findFirst({
          where: and(
            eq(secrets.projectId, secret.projectId),
            eq(secrets.key, secret.key),
            eq(secrets.environment, parsed.data.targetEnvironment)
          ),
        });

        if (existing && !parsed.data.overwrite) {
          skipped++;
          continue;
        }

        if (existing && parsed.data.overwrite) {
          await db
            .update(secrets)
            .set({
              value: secret.value,
              category: secret.category,
              description: secret.description,
              tags: secret.tags,
              version: existing.version + 1,
              updatedAt: new Date(),
              updatedBy: user!.email,
            })
            .where(eq(secrets.id, existing.id));

          await createSecretVersion(
            existing.id,
            secret.value,
            `Overwritten from ${parsed.data.sourceEnvironment}`,
            user!.email
          );
        } else {
          const [newSecret] = await db
            .insert(secrets)
            .values({
              id: randomUUID(),
              projectId: secret.projectId,
              key: secret.key,
              value: secret.value,
              environment: parsed.data.targetEnvironment,
              category: secret.category,
              description: secret.description,
              tags: secret.tags,
              version: 1,
              isEphemeral: secret.isEphemeral,
              expiresAt: secret.expiresAt,
              updatedBy: user!.email,
            })
            .returning();

          await db.insert(secretVersions).values({
            id: `${newSecret.id}_v1`,
            secretId: newSecret.id,
            version: 1,
            value: secret.value,
            comment: `Synced from ${parsed.data.sourceEnvironment}`,
            createdBy: user!.email,
          });
        }

        synced++;
      } catch (err) {
        errors.push(`Failed to sync ${secret.key}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    await logActivity(
      parsed.data.projectId,
      user!.userId,
      user!.email,
      "ENV_SYNC",
      `${parsed.data.sourceEnvironment} -> ${parsed.data.targetEnvironment}`,
      parsed.data.targetEnvironment,
      `Batch synced ${synced} secrets, skipped ${skipped}, errors: ${errors.length}`
    );

    revalidatePath("/dashboard");

    return {
      success: true,
      data: { synced, skipped, errors },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to batch sync secrets",
    };
  }
}

/**
 * Bulk imports secrets from a structured format
 */
export async function bulkImportSecrets(input: z.infer<typeof BulkImportSecretsSchema>) {
  const user = await getCurrentUser();

  const parsed = BulkImportSecretsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  try {
    await checkProjectAccess(user, parsed.data.projectId, "secret:write");

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const secretInput of parsed.data.secrets) {
      try {
        const existing = await db.query.secrets.findFirst({
          where: and(
            eq(secrets.projectId, parsed.data.projectId),
            eq(secrets.key, secretInput.key),
            eq(secrets.environment, parsed.data.environment)
          ),
        });

        if (existing) {
          skipped++;
          continue;
        }

        const encryptedValue = encryptData(secretInput.value);

        const [secret] = await db
          .insert(secrets)
          .values({
            id: randomUUID(),
            projectId: parsed.data.projectId,
            key: secretInput.key,
            value: encryptedValue,
            environment: parsed.data.environment,
            category: secretInput.category,
            description: secretInput.description || "",
            tags: secretInput.tags,
            isEphemeral: secretInput.isEphemeral,
            expiresAt: secretInput.expiresAt ? new Date(secretInput.expiresAt) : null,
            updatedBy: user!.email,
          })
          .returning();

        await db.insert(secretVersions).values({
          id: `${secret.id}_v1`,
          secretId: secret.id,
          version: 1,
          value: encryptedValue,
          comment: "Bulk imported",
          createdBy: user!.email,
        });

        imported++;
      } catch (err) {
        errors.push(`Failed to import ${secretInput.key}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    await logActivity(
      parsed.data.projectId,
      user!.userId,
      user!.email,
      "ENV_SYNC",
      `Bulk import to ${parsed.data.environment}`,
      parsed.data.environment,
      `Bulk imported ${imported} secrets, skipped ${skipped}, errors: ${errors.length}`
    );

    revalidatePath("/dashboard");

    return { success: true, data: { imported, skipped, errors } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to bulk import secrets",
    };
  }
}

// ============================================================================
// Team Member Actions
// ============================================================================

/**
 * Gets all team members for a project
 */
export async function getTeamMembers(input: z.infer<typeof ProjectIdSchema>) {
  const user = await getCurrentUser();

  const parsed = ProjectIdSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  try {
    await checkProjectAccess(user, parsed.data.projectId, "team:manage");

    const members = await db.query.teamMembers.findMany({
      where: eq(teamMembers.projectId, parsed.data.projectId),
      orderBy: (teamMembers, { desc }) => [desc(teamMembers.createdAt)],
    });

    return { success: true, data: members };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch team members",
    };
  }
}

/**
 * Adds a team member to a project
 */
export async function addTeamMember(input: z.infer<typeof AddTeamMemberSchema>) {
  const user = await getCurrentUser();

  const parsed = AddTeamMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  const data = parsed.data;

  try {
    await checkProjectAccess(user, data.projectId, "team:invite");

    // Check if user already exists in project
    const existing = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.projectId, data.projectId),
        eq(teamMembers.userId, data.userId)
      ),
    });

    if (existing) {
      return { success: false, error: "User is already a member of this project" };
    }

    // Cannot add owner if one already exists (unless you're the owner)
    if (data.role === "owner") {
      const existingOwner = await db.query.teamMembers.findFirst({
        where: and(
          eq(teamMembers.projectId, data.projectId),
          eq(teamMembers.role, "owner")
        ),
      });
      if (existingOwner && user?.role !== "owner") {
        return { success: false, error: "Project already has an owner" };
      }
    }

    const [member] = await db
      .insert(teamMembers)
      .values({
        id: randomUUID(),
        projectId: data.projectId,
        userId: data.userId,
        name: data.name,
        email: data.email,
        role: data.role,
        allowedEnvironments: data.allowedEnvironments,
      })
      .returning();

    await logActivity(
      data.projectId,
      user!.userId,
      user!.email,
      "SECRET_CREATED", // Using closest available action
      `${data.name} (${data.email})`,
      "production",
      `Added team member with role: ${data.role}`
    );

    revalidatePath("/dashboard");

    return { success: true, data: member };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add team member",
    };
  }
}

/**
 * Removes a team member from a project
 */
export async function removeTeamMember(input: z.infer<typeof RemoveTeamMemberSchema>) {
  const user = await getCurrentUser();

  const parsed = RemoveTeamMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  try {
    const member = await db.query.teamMembers.findFirst({
      where: eq(teamMembers.id, parsed.data.memberId),
    });

    if (!member) {
      return { success: false, error: "Team member not found" };
    }

    await checkProjectAccess(user, member.projectId, "team:manage");

    // Prevent removing the last owner
    if (member.role === "owner") {
      const ownerCount = await db.$count(
        teamMembers,
        and(
          eq(teamMembers.projectId, member.projectId),
          eq(teamMembers.role, "owner")
        )
      );
      if (ownerCount <= 1) {
        return { success: false, error: "Cannot remove the last owner of the project" };
      }
    }

    await db.delete(teamMembers).where(eq(teamMembers.id, member.id));

    await logActivity(
      member.projectId,
      user!.userId,
      user!.email,
      "SECRET_DELETED", // Using closest available action
      `${member.name} (${member.email})`,
      "production",
      `Removed team member`
    );

    revalidatePath("/dashboard");

    return { success: true, message: "Team member removed successfully" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove team member",
    };
  }
}

/**
 * Updates a team member's role and/or allowed environments
 */
export async function updateTeamMemberRole(input: z.infer<typeof UpdateTeamMemberSchema>) {
  const user = await getCurrentUser();

  const parsed = UpdateTeamMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  try {
    const member = await db.query.teamMembers.findFirst({
      where: eq(teamMembers.id, parsed.data.memberId),
    });

    if (!member) {
      return { success: false, error: "Team member not found" };
    }

    await checkProjectAccess(user, member.projectId, "team:manage");

    // Prevent demoting the last owner
    if (member.role === "owner" && parsed.data.role && parsed.data.role !== "owner") {
      const ownerCount = await db.$count(
        teamMembers,
        and(
          eq(teamMembers.projectId, member.projectId),
          eq(teamMembers.role, "owner")
        )
      );
      if (ownerCount <= 1) {
        return { success: false, error: "Cannot demote the last owner of the project" };
      }
    }

    const [updatedMember] = await db
      .update(teamMembers)
      .set({
        ...(parsed.data.role && { role: parsed.data.role }),
        ...(parsed.data.allowedEnvironments && { allowedEnvironments: parsed.data.allowedEnvironments }),
        lastActive: new Date(),
      })
      .where(eq(teamMembers.id, member.id))
      .returning();

    await logActivity(
      member.projectId,
      user!.userId,
      user!.email,
      "SECRET_UPDATED", // Using closest available action
      `${member.name} (${member.email})`,
      "production",
      `Updated team member: role=${parsed.data.role || member.role}, environments=${parsed.data.allowedEnvironments?.join(",") || member.allowedEnvironments.join(",")}`
    );

    revalidatePath("/dashboard");

    return { success: true, data: updatedMember };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update team member",
    };
  }
}

// ============================================================================
// Agent Harness Actions
// ============================================================================

/**
 * Gets all agent harnesses for a project
 */
export async function getAgentHarnesses(input: z.infer<typeof ProjectIdSchema>) {
  const user = await getCurrentUser();

  const parsed = ProjectIdSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  try {
    await checkProjectAccess(user, parsed.data.projectId, "agent:read");

    const agents = await db.query.agentHarnesses.findMany({
      where: eq(agentHarnesses.projectId, parsed.data.projectId),
      orderBy: (agentHarnesses, { desc }) => [desc(agentHarnesses.createdAt)],
    });

    // Mask sensitive fields
    const safeAgents = agents.map((agent) => ({
      ...agent,
      tokenHash: "[REDACTED]",
    }));

    return { success: true, data: safeAgents };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch agent harnesses",
    };
  }
}

/**
 * Creates a new agent harness
 */
export async function createAgentHarness(input: z.infer<typeof CreateAgentHarnessSchema>) {
  const user = await getCurrentUser();

  const parsed = CreateAgentHarnessSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  const data = parsed.data;

  try {
    await checkProjectAccess(user, data.projectId, "agent:write");

    // Verify all allowed secrets exist
    if (data.allowedSecrets.length > 0) {
      const existingSecrets = await db.query.secrets.findMany({
        where: and(
          eq(secrets.projectId, data.projectId),
          sql`${secrets.id} = ANY(${data.allowedSecrets})`
        ),
      });

      if (existingSecrets.length !== data.allowedSecrets.length) {
        return { success: false, error: "One or more allowed secrets not found" };
      }
    }

    const tokenPrefix = data.name.toLowerCase().replace(/\s+/g, "-").slice(0, 8);
    const { fullToken, tokenHash, tokenLastFour } = generateAgentToken(tokenPrefix);

    const [agent] = await db
      .insert(agentHarnesses)
      .values({
        id: randomUUID(),
        projectId: data.projectId,
        name: data.name,
        description: data.description || "",
        modelProvider: data.modelProvider,
        agentType: data.agentType,
        allowedSecrets: data.allowedSecrets,
        environment: data.environment,
        ephemeralTtlMinutes: data.ephemeralTtlMinutes,
        tokenLimitPerHour: data.tokenLimitPerHour,
        apiKeyAlias: `${tokenPrefix}_${generateSecureToken(8)}`,
        tokenPrefix,
        tokenHash,
        tokenLastFour,
        autoMaskSecrets: data.autoMaskSecrets,
        status: "active",
        expiresAt: new Date(Date.now() + data.ephemeralTtlMinutes * 60 * 1000),
      })
      .returning();

    await logActivity(
      data.projectId,
      user!.userId,
      user!.email,
      "AGENT_TOKEN_ISSUED",
      agent.name,
      data.environment,
      `Created agent harness with token prefix: ${tokenPrefix}`
    );

    revalidatePath("/dashboard");

    return {
      success: true,
      data: {
        agent: { ...agent, tokenHash: "[REDACTED]" },
        token: fullToken, // Only returned once at creation
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create agent harness",
    };
  }
}

/**
 * Updates an agent harness status
 */
export async function updateAgentStatus(input: z.infer<typeof UpdateAgentStatusSchema>) {
  const user = await getCurrentUser();

  const parsed = UpdateAgentStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  try {
    const agent = await db.query.agentHarnesses.findFirst({
      where: eq(agentHarnesses.id, parsed.data.agentId),
    });

    if (!agent) {
      return { success: false, error: "Agent harness not found" };
    }

    await checkProjectAccess(user, agent.projectId, "agent:write");

    const [updatedAgent] = await db
      .update(agentHarnesses)
      .set({
        status: parsed.data.status,
        ...(parsed.data.status === "active" && {
          expiresAt: new Date(Date.now() + agent.ephemeralTtlMinutes * 60 * 1000),
        }),
      })
      .where(eq(agentHarnesses.id, agent.id))
      .returning();

    await logActivity(
      agent.projectId,
      user!.userId,
      user!.email,
      "AGENT_ACCESS_GRANTED",
      agent.name,
      agent.environment,
      `Updated agent status to ${parsed.data.status}`
    );

    revalidatePath("/dashboard");

    return { success: true, data: { ...updatedAgent, tokenHash: "[REDACTED]" } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update agent status",
    };
  }
}

/**
 * Triggers the kill switch for an agent (revokes it)
 */
export async function triggerKillSwitch(input: z.infer<typeof TriggerKillSwitchSchema>) {
  const user = await getCurrentUser();

  const parsed = TriggerKillSwitchSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  try {
    const agent = await db.query.agentHarnesses.findFirst({
      where: eq(agentHarnesses.id, parsed.data.agentId),
    });

    if (!agent) {
      return { success: false, error: "Agent harness not found" };
    }

    await checkProjectAccess(user, agent.projectId, "agent:write");

    await db
      .update(agentHarnesses)
      .set({ status: "revoked" })
      .where(eq(agentHarnesses.id, agent.id));

    await logActivity(
      agent.projectId,
      user!.userId,
      user!.email,
      "AGENT_KILLSWITCH_TRIGGERED",
      agent.name,
      agent.environment,
      parsed.data.reason ? `Kill switch triggered: ${parsed.data.reason}` : "Kill switch triggered"
    );

    revalidatePath("/dashboard");

    return { success: true, message: "Agent kill switch triggered successfully" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to trigger kill switch",
    };
  }
}

/**
 * Rotates an agent's token
 */
export async function rotateAgentToken(input: z.infer<typeof RotateAgentTokenSchema>) {
  const user = await getCurrentUser();

  const parsed = RotateAgentTokenSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  try {
    const agent = await db.query.agentHarnesses.findFirst({
      where: eq(agentHarnesses.id, parsed.data.agentId),
    });

    if (!agent) {
      return { success: false, error: "Agent harness not found" };
    }

    await checkProjectAccess(user, agent.projectId, "agent:write");

    const { fullToken, tokenHash, tokenLastFour } = generateAgentToken(agent.tokenPrefix);

    const [updatedAgent] = await db
      .update(agentHarnesses)
      .set({
        tokenHash,
        tokenLastFour,
        status: "active",
        expiresAt: new Date(Date.now() + agent.ephemeralTtlMinutes * 60 * 1000),
        tokensUsedToday: 0,
      })
      .where(eq(agentHarnesses.id, agent.id))
      .returning();

    await logActivity(
      agent.projectId,
      user!.userId,
      user!.email,
      "KEY_ROTATION",
      agent.name,
      agent.environment,
      `Rotated agent token`
    );

    revalidatePath("/dashboard");

    return {
      success: true,
      data: {
        agent: { ...updatedAgent, tokenHash: "[REDACTED]" },
        token: fullToken, // Only returned once
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to rotate agent token",
    };
  }
}

/**
 * Extends an agent's TTL
 */
export async function extendAgentTTL(input: z.infer<typeof ExtendAgentTTLSchema>) {
  const user = await getCurrentUser();

  const parsed = ExtendAgentTTLSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  try {
    const agent = await db.query.agentHarnesses.findFirst({
      where: eq(agentHarnesses.id, parsed.data.agentId),
    });

    if (!agent) {
      return { success: false, error: "Agent harness not found" };
    }

    await checkProjectAccess(user, agent.projectId, "agent:write");

    const currentExpiry = agent.expiresAt ? new Date(agent.expiresAt) : new Date();
    const newExpiry = new Date(currentExpiry.getTime() + parsed.data.additionalMinutes * 60 * 1000);

    const [updatedAgent] = await db
      .update(agentHarnesses)
      .set({ expiresAt: newExpiry })
      .where(eq(agentHarnesses.id, agent.id))
      .returning();

    await logActivity(
      agent.projectId,
      user!.userId,
      user!.email,
      "AGENT_ACCESS_GRANTED",
      agent.name,
      agent.environment,
      `Extended agent TTL by ${parsed.data.additionalMinutes} minutes`
    );

    revalidatePath("/dashboard");

    return { success: true, data: { ...updatedAgent, tokenHash: "[REDACTED]" } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to extend agent TTL",
    };
  }
}

// ============================================================================
// Activity Log Actions
// ============================================================================

/**
 * Gets activity logs for a project with filtering
 */
export async function getActivityLogs(input: z.infer<typeof GetActivityLogsSchema>) {
  const user = await getCurrentUser();

  const parsed = GetActivityLogsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  try {
    await checkProjectAccess(user, parsed.data.projectId, "audit:read");

    const whereConditions = [eq(activityLogs.projectId, parsed.data.projectId)];

    if (parsed.data.action) {
      whereConditions.push(eq(activityLogs.action, parsed.data.action));
    }

    if (parsed.data.environment) {
      whereConditions.push(eq(activityLogs.environment, parsed.data.environment));
    }

    if (parsed.data.startDate) {
      whereConditions.push(gte(activityLogs.createdAt, new Date(parsed.data.startDate)));
    }

    if (parsed.data.endDate) {
      whereConditions.push(lt(activityLogs.createdAt, new Date(parsed.data.endDate)));
    }

    const logs = await db.query.activityLogs.findMany({
      where: and(...whereConditions),
      orderBy: (activityLogs, { desc }) => [desc(activityLogs.createdAt)],
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });

    const total = await db.$count(activityLogs, and(...whereConditions));

    return { success: true, data: { logs, total } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch activity logs",
    };
  }
}

/**
 * Exports activity logs in JSON or CSV format
 */
export async function exportActivityLogs(input: z.infer<typeof ExportActivityLogsSchema>) {
  const user = await getCurrentUser();

  const parsed = ExportActivityLogsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  try {
    await checkProjectAccess(user, parsed.data.projectId, "audit:export");

    const whereConditions = [eq(activityLogs.projectId, parsed.data.projectId)];

    if (parsed.data.startDate) {
      whereConditions.push(gte(activityLogs.createdAt, new Date(parsed.data.startDate)));
    }

    if (parsed.data.endDate) {
      whereConditions.push(lt(activityLogs.createdAt, new Date(parsed.data.endDate)));
    }

    const logs = await db.query.activityLogs.findMany({
      where: and(...whereConditions),
      orderBy: (activityLogs, { desc }) => [desc(activityLogs.createdAt)],
    });

    if (parsed.data.format === "csv") {
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
      return { success: true, data: csv, contentType: "text/csv" };
    }

    return { success: true, data: logs, contentType: "application/json" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to export activity logs",
    };
  }
}

// ============================================================================
// Project Settings Actions
// ============================================================================

/**
 * Gets project settings
 */
export async function getProjectSettings(input: z.infer<typeof ProjectIdSchema>) {
  const user = await getCurrentUser();

  const parsed = ProjectIdSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  try {
    await checkProjectAccess(user, parsed.data.projectId, "project:settings");

    const settings = await db.query.projectSettings.findFirst({
      where: eq(projectSettings.projectId, parsed.data.projectId),
    });

    if (!settings) {
      return { success: false, error: "Project settings not found" };
    }

    return { success: true, data: settings };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch project settings",
    };
  }
}

/**
 * Updates project settings
 */
export async function updateProjectSettings(input: z.infer<typeof UpdateProjectSettingsSchema>) {
  const user = await getCurrentUser();

  const parsed = UpdateProjectSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  const { projectId, ...updateData } = parsed.data;

  try {
    await checkProjectAccess(user, projectId, "project:settings");

    const [settings] = await db
      .update(projectSettings)
      .set(updateData)
      .where(eq(projectSettings.projectId, projectId))
      .returning();

    await logActivity(
      projectId,
      user!.userId,
      user!.email,
      "SECRET_UPDATED", // Using closest available action
      "Project Settings",
      "production",
      `Updated project settings: ${Object.keys(updateData).join(", ")}`
    );

    revalidatePath("/dashboard");

    return { success: true, data: settings };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update project settings",
    };
  }
}

/**
 * Rotates the master encryption key
 */
export async function rotateMasterKey(input: z.infer<typeof RotateMasterKeySchema>) {
  const user = await getCurrentUser();

  const parsed = RotateMasterKeySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  try {
    await checkProjectAccess(user, parsed.data.projectId, "project:settings");
    authorizeRole(user, "owner");

    const settings = await db.query.projectSettings.findFirst({
      where: eq(projectSettings.projectId, parsed.data.projectId),
    });

    if (!settings) {
      return { success: false, error: "Project settings not found" };
    }

    // Generate new master key fingerprint
    const newFingerprint = `SHA256:${generateSecureToken(32)}`;

    await db
      .update(projectSettings)
      .set({ masterKeyFingerprint: newFingerprint })
      .where(eq(projectSettings.projectId, parsed.data.projectId));

    await logActivity(
      parsed.data.projectId,
      user!.userId,
      user!.email,
      "KEY_ROTATION",
      "AES-256-GCM Master Envelope",
      "production",
      `Rotated master encryption key, new fingerprint: ${newFingerprint}`
    );

    revalidatePath("/dashboard");

    return { success: true, data: { masterKeyFingerprint: newFingerprint } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to rotate master key",
    };
  }
}

/**
 * Resets a project to its seed state
 */
export async function resetProjectToSeed(input: z.infer<typeof ResetProjectToSeedSchema>) {
  const user = await getCurrentUser();

  const parsed = ResetProjectToSeedSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", details: parsed.error.format() };
  }

  try {
    await checkProjectAccess(user, parsed.data.projectId, "project:write");
    authorizeRole(user, "owner");

    // Delete all related data (cascade will handle most)
    await db.delete(activityLogs).where(eq(activityLogs.projectId, parsed.data.projectId));
    await db.delete(secretVersions).where(
      sql`${secretVersions.secretId} IN (SELECT id FROM ${secrets} WHERE project_id = ${parsed.data.projectId})`
    );
    await db.delete(secrets).where(eq(secrets.projectId, parsed.data.projectId));
    await db.delete(agentHarnesses).where(eq(agentHarnesses.projectId, parsed.data.projectId));
    await db.delete(teamMembers).where(eq(teamMembers.projectId, parsed.data.projectId));
    await db.delete(projectSettings).where(eq(projectSettings.projectId, parsed.data.projectId));

    // Re-seed using the seed function
    const { seedDatabase } = await import("@/lib/seed");
    await seedDatabase({
      ownerClerkUserId: parsed.data.ownerClerkUserId,
      ownerName: parsed.data.ownerName,
      ownerEmail: parsed.data.ownerEmail,
      encryptSecretFn: encryptData,
    });

    await logActivity(
      parsed.data.projectId,
      user!.userId,
      user!.email,
      "KEY_ROTATION",
      "Project Reset",
      "production",
      `Reset project to seed state`
    );

    revalidatePath("/dashboard");

    return { success: true, message: "Project reset to seed state successfully" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reset project",
    };
  }
}