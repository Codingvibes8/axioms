import { createHash, randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  activityLogs,
  agentHarnesses,
  projects,
  projectSettings,
  secretVersions,
  secrets,
  teamMembers,
  type AgentStatus,
  type ProjectEnvironment,
} from "./db/schema";

const DEMO_PROJECT_ID = "proj_axiom_core_001";
const DEMO_PROJECT_SLUG = "axiom-core";

function hashDeterministicToken(seedValue: string): {
  hash: string;
  lastFour: string;
} {
  const digest = createHash("sha256").update(seedValue).digest("hex");
  return {
    hash: digest,
    lastFour: digest.slice(-4),
  };
}

async function encodeSeedValue(
  plainValue: string,
  encryptFn?: (value: string) => string
): Promise<string> {
  if (encryptFn) {
    return encryptFn(plainValue);
  }
  const encoded = Buffer.from(plainValue, "utf8").toString("base64");
  return `v1:seed:${encoded}`;
}

interface SeedSecretSpec {
  id: string;
  key: string;
  environment: ProjectEnvironment;
  category: string;
  description: string;
  tags: string[];
  version: number;
  isEphemeral?: boolean;
  expiresAt?: Date | null;
  updatedBy: string;
  snapshots: Array<{
    version: number;
    value: string;
    comment: string;
    createdBy: string;
    minutesAgo: number;
  }>;
}

export async function seedDatabase(options?: {
  ownerClerkUserId?: string;
  ownerName?: string;
  ownerEmail?: string;
  encryptSecretFn?: (value: string) => string;
}): Promise<{ projectId: string; slug: string }> {
  const now = Date.now();
  const minsAgo = (m: number) => new Date(now - m * 60 * 1000);
  const hoursFromNow = (h: number) => new Date(now + h * 60 * 60 * 1000);
  const minsFromNow = (m: number) => new Date(now + m * 60 * 1000);

  const existingProject = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.slug, DEMO_PROJECT_SLUG))
    .limit(1);

  if (existingProject.length > 0) {
    await db.delete(projects).where(eq(projects.id, existingProject[0].id));
  }

  await db.insert(projects).values({
    id: DEMO_PROJECT_ID,
    name: "Axiom Core Platform",
    slug: DEMO_PROJECT_SLUG,
    description:
      "Mission-critical microservices, LLM agent harnesses, and cloud infrastructure secrets.",
    encryptionAlgorithm: "AES-256-GCM",
    environments: ["development", "staging", "production"],
    createdAt: minsAgo(10_080),
    updatedAt: minsAgo(15),
  });

  await db.insert(projectSettings).values({
    projectId: DEMO_PROJECT_ID,
    autoBackupEnabled: true,
    slackWebhookUrl: "https://hooks.slack.com/services/T00000000/B00000000/AXIOMDEMO",
    discordWebhookUrl: "",
    pagerdutyKey: "pd-demo-routing-key-9921",
    requireMfaForProduction: true,
    enableAgentProxyFirewall: true,
    masterKeyFingerprint:
      "SHA256:4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
    auditRetentionDays: 90,
  });

  const seedSecrets: SeedSecretSpec[] = [
    {
      id: "sec_prod_openai",
      key: "OPENAI_API_KEY",
      environment: "production",
      category: "AI / LLM",
      description: "Primary production OpenAI inference key routed via Axiom proxy",
      tags: ["llm", "prod", "proxy-guarded"],
      version: 3,
      updatedBy: "alex.chen@axiom-core.io",
      snapshots: [
        {
          version: 1,
          value: "sk-demo-openai-prod-v1-0001aa10",
          comment: "Initial production key provisioning",
          createdBy: "alex.chen@axiom-core.io",
          minutesAgo: 4320,
        },
        {
          version: 2,
          value: "sk-demo-openai-prod-v2-0002bb20",
          comment: "Scheduled 30-day key rotation",
          createdBy: "sarah.kim@axiom-core.io",
          minutesAgo: 1440,
        },
        {
          version: 3,
          value: "sk-demo-openai-prod-v3-0003bc10",
          comment: "Rotated after quota tier upgrade",
          createdBy: "alex.chen@axiom-core.io",
          minutesAgo: 180,
        },
      ],
    },
    {
      id: "sec_prod_anthropic",
      key: "ANTHROPIC_API_KEY",
      environment: "production",
      category: "AI / LLM",
      description: "Anthropic Claude model credential for coding & reasoning agents",
      tags: ["anthropic", "claude", "prod"],
      version: 1,
      updatedBy: "alex.chen@axiom-core.io",
      snapshots: [
        {
          version: 1,
          value: "sk-ant-demo-prod-9981xy44",
          comment: "Initial Anthropic production key",
          createdBy: "alex.chen@axiom-core.io",
          minutesAgo: 2880,
        },
      ],
    },
    {
      id: "sec_prod_db_url",
      key: "DATABASE_URL",
      environment: "production",
      category: "Database",
      description: "Neon primary pooled connection string with TLS required",
      tags: ["postgres", "neon", "critical"],
      version: 2,
      updatedBy: "sarah.kim@axiom-core.io",
      snapshots: [
        {
          version: 1,
          value: "postgresql://axiom_app:demo_v1_pass@ep-prod-1.neon.tech/axiom?sslmode=require",
          comment: "Initial production database connection string",
          createdBy: "alex.chen@axiom-core.io",
          minutesAgo: 5760,
        },
        {
          version: 2,
          value: "postgresql://axiom_app:demo_v2_pass@ep-prod-1.neon.tech/axiom?sslmode=require&pgbouncer=true",
          comment: "Enabled pooler query parameter and rotated password",
          createdBy: "sarah.kim@axiom-core.io",
          minutesAgo: 720,
        },
      ],
    },
    {
      id: "sec_prod_stripe",
      key: "STRIPE_SECRET_KEY",
      environment: "production",
      category: "API Key",
      description: "Live Stripe secret key for subscription billing webhooks",
      tags: ["billing", "stripe", "live"],
      version: 2,
      updatedBy: "sarah.kim@axiom-core.io",
      snapshots: [
        {
          version: 1,
          value: "sk_live_demo_51N001aB2cD3eF4gH5iJ",
          comment: "Initial live billing secret",
          createdBy: "alex.chen@axiom-core.io",
          minutesAgo: 3600,
        },
        {
          version: 2,
          value: "sk_live_demo_51N002zY9xW8vU7tS6rQ",
          comment: "Quarterly Stripe secret rotation",
          createdBy: "sarah.kim@axiom-core.io",
          minutesAgo: 480,
        },
      ],
    },
    {
      id: "sec_prod_aws_key",
      key: "AWS_ACCESS_KEY_ID",
      environment: "production",
      category: "Cloud",
      description: "IAM access key ID for production KMS & artifact bucket",
      tags: ["aws", "iam", "kms"],
      version: 1,
      updatedBy: "alex.chen@axiom-core.io",
      snapshots: [
        {
          version: 1,
          value: "AKIA_DEMO_PROD_778899AABBCC",
          comment: "Provisioned IAM key for KMS envelope backups",
          createdBy: "alex.chen@axiom-core.io",
          minutesAgo: 2160,
        },
      ],
    },
    {
      id: "sec_prod_aws_secret",
      key: "AWS_SECRET_ACCESS_KEY",
      environment: "production",
      category: "Cloud",
      description: "IAM secret access key paired with AWS_ACCESS_KEY_ID",
      tags: ["aws", "iam", "secret"],
      version: 1,
      updatedBy: "alex.chen@axiom-core.io",
      snapshots: [
        {
          version: 1,
          value: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYDEMOKEY991",
          comment: "Provisioned IAM secret key",
          createdBy: "alex.chen@axiom-core.io",
          minutesAgo: 2160,
        },
      ],
    },
    {
      id: "sec_prod_clerk_secret",
      key: "CLERK_SECRET_KEY",
      environment: "production",
      category: "OAuth",
      description: "Clerk backend session verification secret for production",
      tags: ["auth", "clerk", "sso"],
      version: 1,
      updatedBy: "sarah.kim@axiom-core.io",
      snapshots: [
        {
          version: 1,
          value: "sk_live_clerk_demo_9918273645abcd",
          comment: "Configured Clerk production auth key",
          createdBy: "sarah.kim@axiom-core.io",
          minutesAgo: 1900,
        },
      ],
    },
    {
      id: "sec_prod_redis_url",
      key: "REDIS_URL",
      environment: "production",
      category: "Infra",
      description: "Upstash/Redis TLS endpoint for rate limiting and agent quotas",
      tags: ["redis", "rate-limit", "cache"],
      version: 1,
      isEphemeral: true,
      expiresAt: hoursFromNow(168),
      updatedBy: "sarah.kim@axiom-core.io",
      snapshots: [
        {
          version: 1,
          value: "rediss://default:demo_redis_token_8821@prod-cache.upstash.io:6379",
          comment: "Ephemeral 7-day cache credential",
          createdBy: "sarah.kim@axiom-core.io",
          minutesAgo: 960,
        },
      ],
    },
    {
      id: "sec_prod_sentry_dsn",
      key: "SENTRY_DSN",
      environment: "production",
      category: "Infra",
      description: "Production error telemetry ingestion DSN",
      tags: ["observability", "sentry"],
      version: 1,
      updatedBy: "alex.chen@axiom-core.io",
      snapshots: [
        {
          version: 1,
          value: "https://demoPublicKey123@o450000.ingest.sentry.io/450001",
          comment: "Added Sentry telemetry DSN",
          createdBy: "alex.chen@axiom-core.io",
          minutesAgo: 3100,
        },
      ],
    },
    {
      id: "sec_stg_openai",
      key: "OPENAI_API_KEY",
      environment: "staging",
      category: "AI / LLM",
      description: "Staging OpenAI key for QA and evaluation harnesses",
      tags: ["llm", "staging", "qa"],
      version: 1,
      updatedBy: "sarah.kim@axiom-core.io",
      snapshots: [
        {
          version: 1,
          value: "sk-demo-openai-stg-1111aa01",
          comment: "Initial staging LLM key",
          createdBy: "sarah.kim@axiom-core.io",
          minutesAgo: 2500,
        },
      ],
    },
    {
      id: "sec_stg_db_url",
      key: "DATABASE_URL",
      environment: "staging",
      category: "Database",
      description: "Staging database branch connection string",
      tags: ["postgres", "staging"],
      version: 1,
      updatedBy: "marcus.lee@axiom-core.io",
      snapshots: [
        {
          version: 1,
          value: "postgresql://axiom_stg:demo_stg_pass@ep-stg-2.neon.tech/axiom_stg?sslmode=require",
          comment: "Staging branch DB URI",
          createdBy: "marcus.lee@axiom-core.io",
          minutesAgo: 2400,
        },
      ],
    },
    {
      id: "sec_stg_stripe",
      key: "STRIPE_SECRET_KEY",
      environment: "staging",
      category: "API Key",
      description: "Stripe test-mode secret key for staging checkout flows",
      tags: ["stripe", "test-mode", "staging"],
      version: 1,
      updatedBy: "sarah.kim@axiom-core.io",
      snapshots: [
        {
          version: 1,
          value: "sk_test_demo_51S000testKey987654321",
          comment: "Staging test-mode Stripe key",
          createdBy: "sarah.kim@axiom-core.io",
          minutesAgo: 2000,
        },
      ],
    },
    {
      id: "sec_stg_resend",
      key: "RESEND_API_KEY",
      environment: "staging",
      category: "API Key",
      description: "Transactional email sandbox key for staging notifications",
      tags: ["email", "resend", "staging"],
      version: 1,
      updatedBy: "marcus.lee@axiom-core.io",
      snapshots: [
        {
          version: 1,
          value: "re_demo_staging_77665544332211",
          comment: "Added Resend staging key",
          createdBy: "marcus.lee@axiom-core.io",
          minutesAgo: 1200,
        },
      ],
    },
    {
      id: "sec_dev_openai",
      key: "OPENAI_API_KEY",
      environment: "development",
      category: "AI / LLM",
      description: "Local developer OpenAI sandbox API key",
      tags: ["llm", "dev", "local"],
      version: 1,
      updatedBy: "marcus.lee@axiom-core.io",
      snapshots: [
        {
          version: 1,
          value: "sk-demo-openai-dev-0000dev0001",
          comment: "Developer sandbox key",
          createdBy: "marcus.lee@axiom-core.io",
          minutesAgo: 1800,
        },
      ],
    },
    {
      id: "sec_dev_db_url",
      key: "DATABASE_URL",
      environment: "development",
      category: "Database",
      description: "Localhost PostgreSQL connection string for development",
      tags: ["postgres", "localhost", "dev"],
      version: 1,
      updatedBy: "marcus.lee@axiom-core.io",
      snapshots: [
        {
          version: 1,
          value: "postgresql://postgres:postgres@localhost:5432/axiom_dev",
          comment: "Local PostgreSQL connection URL",
          createdBy: "marcus.lee@axiom-core.io",
          minutesAgo: 1800,
        },
      ],
    },
    {
      id: "sec_dev_github_token",
      key: "GITHUB_TOKEN",
      environment: "development",
      category: "OAuth",
      description: "Scoped GitHub fine-grained token for local PR & issue workflows",
      tags: ["github", "git", "dev"],
      version: 1,
      isEphemeral: true,
      expiresAt: hoursFromNow(48),
      updatedBy: "marcus.lee@axiom-core.io",
      snapshots: [
        {
          version: 1,
          value: "github_pat_demo_dev_11223344556677889900",
          comment: "48h scoped dev token",
          createdBy: "marcus.lee@axiom-core.io",
          minutesAgo: 600,
        },
      ],
    },
    {
      id: "sec_dev_posthog",
      key: "NEXT_PUBLIC_POSTHOG_KEY",
      environment: "development",
      category: "General",
      description: "Public product analytics project key for local telemetry checks",
      tags: ["analytics", "posthog", "public"],
      version: 1,
      updatedBy: "priya.nair@axiom-core.io",
      snapshots: [
        {
          version: 1,
          value: "phc_demo_dev_key_aabbccddeeff1122",
          comment: "Local analytics key",
          createdBy: "priya.nair@axiom-core.io",
          minutesAgo: 1500,
        },
      ],
    },
    {
      id: "sec_dev_jwt",
      key: "JWT_SIGNING_SECRET",
      environment: "development",
      category: "General",
      description: "Local development HMAC signing secret for internal tokens",
      tags: ["jwt", "crypto", "dev"],
      version: 1,
      updatedBy: "marcus.lee@axiom-core.io",
      snapshots: [
        {
          version: 1,
          value: "dev_jwt_signing_secret_not_for_prod_9876543210",
          comment: "Dev JWT signing secret",
          createdBy: "marcus.lee@axiom-core.io",
          minutesAgo: 1100,
        },
      ],
    },
  ];

  for (const s of seedSecrets) {
    const latestSnapshot = s.snapshots[s.snapshots.length - 1];
    const encryptedCurrent = await encodeSeedValue(
      latestSnapshot.value,
      options?.encryptSecretFn
    );

    await db.insert(secrets).values({
      id: s.id,
      projectId: DEMO_PROJECT_ID,
      key: s.key,
      value: encryptedCurrent,
      environment: s.environment,
      category: s.category,
      description: s.description,
      tags: s.tags,
      version: s.version,
      isEphemeral: Boolean(s.isEphemeral),
      expiresAt: s.expiresAt ?? null,
      lastRotatedAt: minsAgo(latestSnapshot.minutesAgo),
      createdAt: minsAgo(s.snapshots[0].minutesAgo),
      updatedAt: minsAgo(latestSnapshot.minutesAgo),
      updatedBy: s.updatedBy,
    });

    for (const snap of s.snapshots) {
      const encryptedSnap = await encodeSeedValue(
        snap.value,
        options?.encryptSecretFn
      );
      await db.insert(secretVersions).values({
        id: `${s.id}_v${snap.version}`,
        secretId: s.id,
        version: snap.version,
        value: encryptedSnap,
        comment: snap.comment,
        createdAt: minsAgo(snap.minutesAgo),
        createdBy: snap.createdBy,
      });
    }
  }

  const membersToInsert: Array<typeof teamMembers.$inferInsert> = [
    {
      id: "tm_alex_chen",
      projectId: DEMO_PROJECT_ID,
      userId:
        options?.ownerClerkUserId && options.ownerClerkUserId.length > 0
          ? options.ownerClerkUserId
          : "user_demo_alex_chen_owner",
      name: options?.ownerName?.trim() || "Alex Chen",
      email: options?.ownerEmail?.trim() || "alex.chen@axiom-core.io",
      role: "owner",
      allowedEnvironments: ["development", "staging", "production"],
      createdAt: minsAgo(10_080),
      lastActive: minsAgo(5),
    },
    {
      id: "tm_sarah_kim",
      projectId: DEMO_PROJECT_ID,
      userId: "user_demo_sarah_kim_admin",
      name: "Sarah Kim",
      email: "sarah.kim@axiom-core.io",
      role: "admin",
      allowedEnvironments: ["development", "staging", "production"],
      createdAt: minsAgo(8_640),
      lastActive: minsAgo(22),
    },
    {
      id: "tm_marcus_lee",
      projectId: DEMO_PROJECT_ID,
      userId: "user_demo_marcus_lee_dev",
      name: "Marcus Lee",
      email: "marcus.lee@axiom-core.io",
      role: "developer",
      allowedEnvironments: ["development", "staging"],
      createdAt: minsAgo(7_200),
      lastActive: minsAgo(48),
    },
    {
      id: "tm_priya_nair",
      projectId: DEMO_PROJECT_ID,
      userId: "user_demo_priya_nair_viewer",
      name: "Priya Nair",
      email: "priya.nair@axiom-core.io",
      role: "viewer",
      allowedEnvironments: ["development"],
      createdAt: minsAgo(4_320),
      lastActive: minsAgo(190),
    },
    {
      id: "tm_ci_deployer_agent",
      projectId: DEMO_PROJECT_ID,
      userId: "svc_demo_ci_deployer_agent",
      name: "CI Deployer",
      email: "ci-deployer@agents.axiom-core.io",
      role: "agent",
      allowedEnvironments: ["production"],
      createdAt: minsAgo(5_000),
      lastActive: minsAgo(360),
    },
  ];

  const uniqueMembersMap = new Map<string, typeof teamMembers.$inferInsert>();
  for (const m of membersToInsert) {
    uniqueMembersMap.set(m.userId, m);
  }
  await db.insert(teamMembers).values(Array.from(uniqueMembersMap.values()));

  const claudeToken = hashDeterministicToken("demo-seed-token-claude-code-proxy");
  const autogptToken = hashDeterministicToken("demo-seed-token-autogpt-researcher");
  const cicdToken = hashDeterministicToken("demo-seed-token-cicd-deployer");

  const harnessesToInsert: Array<{
    id: string;
    name: string;
    description: string;
    modelProvider: string;
    agentType: string;
    allowedSecrets: string[];
    environment: ProjectEnvironment;
    status: AgentStatus;
    ephemeralTtlMinutes: number;
    tokenLimitPerHour: number;
    tokensUsedToday: number;
    apiKeyAlias: string;
    tokenPrefix: string;
    tokenHash: string;
    tokenLastFour: string;
    autoMaskSecrets: boolean;
    lastInvoked: Date | null;
    expiresAt: Date | null;
  }> = [
    {
      id: "agt_claude_code_proxy",
      name: "Claude Code Proxy",
      description:
        "Zero-trust credential proxy for Claude Code autonomous engineering sessions",
      modelProvider: "Anthropic",
      agentType: "Coding Assistant",
      allowedSecrets: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"],
      environment: "production",
      status: "active",
      ephemeralTtlMinutes: 60,
      tokenLimitPerHour: 50000,
      tokensUsedToday: 18420,
      apiKeyAlias: "axm_live_claude_code_7f3a",
      tokenPrefix: "axm_",
      tokenHash: claudeToken.hash,
      tokenLastFour: claudeToken.lastFour,
      autoMaskSecrets: true,
      lastInvoked: minsAgo(12),
      expiresAt: minsFromNow(55),
    },
    {
      id: "agt_autogpt_researcher",
      name: "AutoGPT Researcher",
      description:
        "Sandboxed autonomous research worker scoped strictly to staging credentials",
      modelProvider: "OpenAI",
      agentType: "Autonomous Agent",
      allowedSecrets: ["OPENAI_API_KEY"],
      environment: "staging",
      status: "sandboxed",
      ephemeralTtlMinutes: 30,
      tokenLimitPerHour: 25000,
      tokensUsedToday: 6150,
      apiKeyAlias: "axm_stg_autogpt_4c9e",
      tokenPrefix: "axm_",
      tokenHash: autogptToken.hash,
      tokenLastFour: autogptToken.lastFour,
      autoMaskSecrets: true,
      lastInvoked: minsAgo(95),
      expiresAt: minsFromNow(22),
    },
    {
      id: "agt_cicd_deployer",
      name: "CI/CD Deployer",
      description:
        "Deployment runner harness currently revoked after scheduled release window",
      modelProvider: "Custom LLM",
      agentType: "CI/CD Pipeline",
      allowedSecrets: ["DATABASE_URL", "STRIPE_SECRET_KEY"],
      environment: "production",
      status: "revoked",
      ephemeralTtlMinutes: 120,
      tokenLimitPerHour: 100000,
      tokensUsedToday: 0,
      apiKeyAlias: "axm_rev_cicd_9b12",
      tokenPrefix: "axm_",
      tokenHash: cicdToken.hash,
      tokenLastFour: cicdToken.lastFour,
      autoMaskSecrets: true,
      lastInvoked: minsAgo(420),
      expiresAt: minsAgo(60),
    },
  ];

  for (const h of harnessesToInsert) {
    await db.insert(agentHarnesses).values({
      id: h.id,
      projectId: DEMO_PROJECT_ID,
      name: h.name,
      description: h.description,
      modelProvider: h.modelProvider,
      agentType: h.agentType,
      allowedSecrets: h.allowedSecrets,
      environment: h.environment,
      status: h.status,
      ephemeralTtlMinutes: h.ephemeralTtlMinutes,
      tokenLimitPerHour: h.tokenLimitPerHour,
      tokensUsedToday: h.tokensUsedToday,
      apiKeyAlias: h.apiKeyAlias,
      tokenPrefix: h.tokenPrefix,
      tokenHash: h.tokenHash,
      tokenLastFour: h.tokenLastFour,
      autoMaskSecrets: h.autoMaskSecrets,
      createdAt: minsAgo(2880),
      lastInvoked: h.lastInvoked,
      expiresAt: h.expiresAt,
    });
  }

  const logsToInsert: Array<typeof activityLogs.$inferInsert> = [
    {
      id: `aud_${randomUUID().slice(0, 8)}`,
      projectId: DEMO_PROJECT_ID,
      userName: "Alex Chen",
      userEmail: "alex.chen@axiom-core.io",
      action: "MFA_ENABLED",
      resourceName: "production-vault-policy",
      environment: "production",
      details: "Enforced Clerk MFA challenge for all production secret reveals",
      ipAddress: "198.51.100.14",
      createdAt: minsAgo(720),
    },
    {
      id: `aud_${randomUUID().slice(0, 8)}`,
      projectId: DEMO_PROJECT_ID,
      userName: "Sarah Kim",
      userEmail: "sarah.kim@axiom-core.io",
      action: "SECRET_UPDATED",
      resourceName: "DATABASE_URL",
      environment: "production",
      details: "Rotated to v2 with PgBouncer transaction pooling enabled",
      ipAddress: "198.51.100.28",
      createdAt: minsAgo(640),
    },
    {
      id: `aud_${randomUUID().slice(0, 8)}`,
      projectId: DEMO_PROJECT_ID,
      userName: "Sarah Kim",
      userEmail: "sarah.kim@axiom-core.io",
      action: "SECRET_UPDATED",
      resourceName: "STRIPE_SECRET_KEY",
      environment: "production",
      details: "Rotated to v2 during quarterly billing credential cycle",
      ipAddress: "198.51.100.28",
      createdAt: minsAgo(480),
    },
    {
      id: `aud_${randomUUID().slice(0, 8)}`,
      projectId: DEMO_PROJECT_ID,
      userName: "Alex Chen",
      userEmail: "alex.chen@axiom-core.io",
      action: "AGENT_KILLSWITCH_TRIGGERED",
      resourceName: "CI/CD Deployer",
      environment: "production",
      details: "Revoked active deployment harness tokens after release completion",
      ipAddress: "198.51.100.14",
      createdAt: minsAgo(410),
    },
    {
      id: `aud_${randomUUID().slice(0, 8)}`,
      projectId: DEMO_PROJECT_ID,
      userName: "Marcus Lee",
      userEmail: "marcus.lee@axiom-core.io",
      action: "SECRET_CREATED",
      resourceName: "GITHUB_TOKEN",
      environment: "development",
      details: "Created 48h ephemeral fine-grained GitHub token for local PR tooling",
      ipAddress: "203.0.113.42",
      createdAt: minsAgo(350),
    },
    {
      id: `aud_${randomUUID().slice(0, 8)}`,
      projectId: DEMO_PROJECT_ID,
      userName: "Alex Chen",
      userEmail: "alex.chen@axiom-core.io",
      action: "AGENT_TOKEN_ISSUED",
      resourceName: "Claude Code Proxy",
      environment: "production",
      details: "Issued scoped 60m proxy token for alias axm_live_claude_code_7f3a",
      ipAddress: "198.51.100.14",
      createdAt: minsAgo(260),
    },
    {
      id: `aud_${randomUUID().slice(0, 8)}`,
      projectId: DEMO_PROJECT_ID,
      userName: "Sarah Kim",
      userEmail: "sarah.kim@axiom-core.io",
      action: "ENV_SYNC",
      resourceName: "development -> staging",
      environment: "staging",
      details: "Synchronized 3 baseline environment variables with version snapshots",
      ipAddress: "198.51.100.28",
      createdAt: minsAgo(210),
    },
    {
      id: `aud_${randomUUID().slice(0, 8)}`,
      projectId: DEMO_PROJECT_ID,
      userName: "Alex Chen",
      userEmail: "alex.chen@axiom-core.io",
      action: "SECRET_UPDATED",
      resourceName: "OPENAI_API_KEY",
      environment: "production",
      details: "Rotated to v3 with zero-downtime snapshot history",
      ipAddress: "198.51.100.14",
      createdAt: minsAgo(180),
    },
    {
      id: `aud_${randomUUID().slice(0, 8)}`,
      projectId: DEMO_PROJECT_ID,
      userName: "Alex Chen",
      userEmail: "alex.chen@axiom-core.io",
      action: "KEY_ROTATION",
      resourceName: "AES-256-GCM Master Envelope",
      environment: "production",
      details: "Verified envelope key ring integrity and fingerprint checksum",
      ipAddress: "198.51.100.14",
      createdAt: minsAgo(120),
    },
    {
      id: `aud_${randomUUID().slice(0, 8)}`,
      projectId: DEMO_PROJECT_ID,
      userName: "Claude Code Proxy",
      userEmail: "axm_live_claude_code_7f3a@proxy.axiom.local",
      action: "AGENT_ACCESS_GRANTED",
      resourceName: "OPENAI_API_KEY",
      environment: "production",
      details: "Proxied masked request (1,240 tokens); raw key never exposed to LLM",
      ipAddress: "198.51.100.77",
      createdAt: minsAgo(55),
    },
    {
      id: `aud_${randomUUID().slice(0, 8)}`,
      projectId: DEMO_PROJECT_ID,
      userName: "Alex Chen",
      userEmail: "alex.chen@axiom-core.io",
      action: "SECRET_READ",
      resourceName: "CLERK_SECRET_KEY",
      environment: "production",
      details: "Authorized production value reveal audited for compliance",
      ipAddress: "198.51.100.14",
      createdAt: minsAgo(25),
    },
    {
      id: `aud_${randomUUID().slice(0, 8)}`,
      projectId: DEMO_PROJECT_ID,
      userName: "Claude Code Proxy",
      userEmail: "axm_live_claude_code_7f3a@proxy.axiom.local",
      action: "AGENT_ACCESS_GRANTED",
      resourceName: "ANTHROPIC_API_KEY",
      environment: "production",
      details: "Proxied masked request (890 tokens); quota at 18,420 / 50,000",
      ipAddress: "198.51.100.77",
      createdAt: minsAgo(12),
    },
  ];

  await db.insert(activityLogs).values(logsToInsert);

  return {
    projectId: DEMO_PROJECT_ID,
    slug: DEMO_PROJECT_SLUG,
  };
}
