CREATE TYPE "public"."agent_status" AS ENUM('active', 'sandboxed', 'revoked', 'rate_limited');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'developer', 'viewer', 'agent');--> statement-breakpoint
CREATE TYPE "public"."project_environment" AS ENUM('development', 'staging', 'production');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_name" text NOT NULL,
	"user_email" text NOT NULL,
	"action" text NOT NULL,
	"resource_name" text NOT NULL,
	"environment" "project_environment" DEFAULT 'production' NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"ip_address" text DEFAULT '127.0.0.1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_harnesses" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"model_provider" text DEFAULT 'Anthropic' NOT NULL,
	"agent_type" text DEFAULT 'Coding Assistant' NOT NULL,
	"allowed_secrets" text[] DEFAULT '{}' NOT NULL,
	"environment" "project_environment" DEFAULT 'development' NOT NULL,
	"status" "agent_status" DEFAULT 'active' NOT NULL,
	"ephemeral_ttl_minutes" integer DEFAULT 60 NOT NULL,
	"token_limit_per_hour" integer DEFAULT 50000 NOT NULL,
	"tokens_used_today" integer DEFAULT 0 NOT NULL,
	"api_key_alias" text NOT NULL,
	"token_prefix" text DEFAULT 'axm_' NOT NULL,
	"token_hash" text NOT NULL,
	"token_last_four" text NOT NULL,
	"auto_mask_secrets" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_invoked" timestamp with time zone,
	"expires_at" timestamp with time zone,
	CONSTRAINT "agent_harnesses_api_key_alias_unique" UNIQUE("api_key_alias")
);
--> statement-breakpoint
CREATE TABLE "project_settings" (
	"project_id" text PRIMARY KEY NOT NULL,
	"auto_backup_enabled" boolean DEFAULT true NOT NULL,
	"slack_webhook_url" text DEFAULT '' NOT NULL,
	"discord_webhook_url" text DEFAULT '' NOT NULL,
	"pagerduty_key" text DEFAULT '' NOT NULL,
	"require_mfa_for_production" boolean DEFAULT true NOT NULL,
	"enable_agent_proxy_firewall" boolean DEFAULT true NOT NULL,
	"master_key_fingerprint" text DEFAULT 'SHA256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08' NOT NULL,
	"audit_retention_days" integer DEFAULT 90 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"encryption_algorithm" text DEFAULT 'AES-256-GCM' NOT NULL,
	"environments" text[] DEFAULT '{"development","staging","production"}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "secret_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"secret_id" text NOT NULL,
	"version" integer NOT NULL,
	"value" text NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text DEFAULT 'system@axiom.local' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "secrets" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"environment" "project_environment" DEFAULT 'development' NOT NULL,
	"category" text DEFAULT 'General' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_ephemeral" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"last_rotated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system@axiom.local' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "member_role" DEFAULT 'developer' NOT NULL,
	"allowed_environments" "project_environment"[] DEFAULT '{"development"}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_harnesses" ADD CONSTRAINT "agent_harnesses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_settings" ADD CONSTRAINT "project_settings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secret_versions" ADD CONSTRAINT "secret_versions_secret_id_secrets_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."secrets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secrets" ADD CONSTRAINT "secrets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_project_id_idx" ON "activity_logs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "agent_harnesses_project_id_idx" ON "agent_harnesses" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "secret_versions_secret_version_idx" ON "secret_versions" USING btree ("secret_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "secrets_project_key_env_idx" ON "secrets" USING btree ("project_id","key","environment");--> statement-breakpoint
CREATE INDEX "secrets_project_id_idx" ON "secrets" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_project_user_idx" ON "team_members" USING btree ("project_id","user_id");