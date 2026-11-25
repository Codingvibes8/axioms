import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const projectEnvironmentEnum = pgEnum("project_environment", [
  "development",
  "staging",
  "production",
]);

export const memberRoleEnum = pgEnum("member_role", [
  "owner",
  "admin",
  "developer",
  "viewer",
  "agent",
]);

export const agentStatusEnum = pgEnum("agent_status", [
  "active",
  "sandboxed",
  "revoked",
  "rate_limited",
]);

export type ProjectEnvironment = (typeof projectEnvironmentEnum.enumValues)[number];
export type MemberRole = (typeof memberRoleEnum.enumValues)[number];
export type AgentStatus = (typeof agentStatusEnum.enumValues)[number];

export const ACTIVITY_ACTIONS = [
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

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const SECRET_CATEGORIES = [
  "API Key",
  "Database",
  "OAuth",
  "AI / LLM",
  "Cloud",
  "Infra",
  "General",
] as const;

export type SecretCategory = (typeof SECRET_CATEGORIES)[number];

export const MODEL_PROVIDERS = [
  "OpenAI",
  "Anthropic",
  "Google Gemini",
  "DeepSeek",
  "Custom LLM",
] as const;

export type ModelProvider = (typeof MODEL_PROVIDERS)[number];

export const AGENT_TYPES = [
  "Autonomous Agent",
  "Coding Assistant",
  "CI/CD Pipeline",
  "Data Extractor",
  "Customer Support Bot",
] as const;

export type AgentType = (typeof AGENT_TYPES)[number];

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  encryptionAlgorithm: text("encryption_algorithm")
    .notNull()
    .default("AES-256-GCM"),
  environments: text("environments")
    .array()
    .notNull()
    .default(["development", "staging", "production"]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const secrets = pgTable(
  "secrets",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    environment: projectEnvironmentEnum("environment")
      .notNull()
      .default("development"),
    category: text("category").notNull().default("General"),
    description: text("description").notNull().default(""),
    tags: text("tags").array().notNull().default([]),
    version: integer("version").notNull().default(1),
    isEphemeral: boolean("is_ephemeral").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastRotatedAt: timestamp("last_rotated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: text("updated_by").notNull().default("system@axiom.local"),
  },
  (table) => [
    uniqueIndex("secrets_project_key_env_idx").on(
      table.projectId,
      table.key,
      table.environment
    ),
    index("secrets_project_id_idx").on(table.projectId),
  ]
);

export const secretVersions = pgTable(
  "secret_versions",
  {
    id: text("id").primaryKey(),
    secretId: text("secret_id")
      .notNull()
      .references(() => secrets.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    value: text("value").notNull(),
    comment: text("comment").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text("created_by").notNull().default("system@axiom.local"),
  },
  (table) => [
    uniqueIndex("secret_versions_secret_version_idx").on(
      table.secretId,
      table.version
    ),
  ]
);

export const teamMembers = pgTable(
  "team_members",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: memberRoleEnum("role").notNull().default("developer"),
    allowedEnvironments: projectEnvironmentEnum("allowed_environments")
      .array()
      .notNull()
      .default(["development"]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastActive: timestamp("last_active", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("team_members_project_user_idx").on(
      table.projectId,
      table.userId
    ),
  ]
);

export const agentHarnesses = pgTable(
  "agent_harnesses",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    modelProvider: text("model_provider").notNull().default("Anthropic"),
    agentType: text("agent_type").notNull().default("Coding Assistant"),
    allowedSecrets: text("allowed_secrets").array().notNull().default([]),
    environment: projectEnvironmentEnum("environment")
      .notNull()
      .default("development"),
    status: agentStatusEnum("status").notNull().default("active"),
    ephemeralTtlMinutes: integer("ephemeral_ttl_minutes").notNull().default(60),
    tokenLimitPerHour: integer("token_limit_per_hour").notNull().default(50000),
    tokensUsedToday: integer("tokens_used_today").notNull().default(0),
    apiKeyAlias: text("api_key_alias").notNull().unique(),
    tokenPrefix: text("token_prefix").notNull().default("axm_"),
    tokenHash: text("token_hash").notNull(),
    tokenLastFour: text("token_last_four").notNull(),
    autoMaskSecrets: boolean("auto_mask_secrets").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastInvoked: timestamp("last_invoked", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [index("agent_harnesses_project_id_idx").on(table.projectId)]
);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userName: text("user_name").notNull(),
    userEmail: text("user_email").notNull(),
    action: text("action").notNull(),
    resourceName: text("resource_name").notNull(),
    environment: projectEnvironmentEnum("environment")
      .notNull()
      .default("production"),
    details: text("details").notNull().default(""),
    ipAddress: text("ip_address").notNull().default("127.0.0.1"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("activity_logs_project_id_idx").on(table.projectId),
    index("activity_logs_created_at_idx").on(table.createdAt),
  ]
);

export const projectSettings = pgTable("project_settings", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  autoBackupEnabled: boolean("auto_backup_enabled").notNull().default(true),
  slackWebhookUrl: text("slack_webhook_url").notNull().default(""),
  discordWebhookUrl: text("discord_webhook_url").notNull().default(""),
  pagerdutyKey: text("pagerduty_key").notNull().default(""),
  requireMfaForProduction: boolean("require_mfa_for_production")
    .notNull()
    .default(true),
  enableAgentProxyFirewall: boolean("enable_agent_proxy_firewall")
    .notNull()
    .default(true),
  masterKeyFingerprint: text("master_key_fingerprint")
    .notNull()
    .default(
      "SHA256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
    ),
  auditRetentionDays: integer("audit_retention_days").notNull().default(90),
});

export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;

export type SecretRow = typeof secrets.$inferSelect;
export type NewSecretRow = typeof secrets.$inferInsert;

export type SecretVersionRow = typeof secretVersions.$inferSelect;
export type NewSecretVersionRow = typeof secretVersions.$inferInsert;

export type TeamMemberRow = typeof teamMembers.$inferSelect;
export type NewTeamMemberRow = typeof teamMembers.$inferInsert;

export type AgentHarnessRow = typeof agentHarnesses.$inferSelect;
export type NewAgentHarnessRow = typeof agentHarnesses.$inferInsert;

export type ActivityLogRow = typeof activityLogs.$inferSelect;
export type NewActivityLogRow = typeof activityLogs.$inferInsert;

export type ProjectSettingsRow = typeof projectSettings.$inferSelect;
export type NewProjectSettingsRow = typeof projectSettings.$inferInsert;
