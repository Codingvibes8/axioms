### Implementation Plan.

#### 1. Next.js 16 Scaffolding, Security Headers & Design System

- Initialize a Next.js 16+ App Router (`--turbopack`, `--typescript`, `--tailwind`, `--eslint`, `--src-dir`, `@/*` alias) project with React 19, Tailwind CSS v4 (`@import "tailwindcss"` and `@theme inline` in `src/app/globals.css`, __no__ `tailwind.config.ts`), shadcn/ui (New York, zinc base, CSS variables), `lucide-react`, `sonner`, `zod`, `@neondatabase/serverless`, `drizzle-orm`, `drizzle-kit`, `@clerk/nextjs`, `tsx`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, and `@playwright/test`.

- Before writing route/middleware/layout code, inspect `node_modules/next/dist/docs/` to verify Next.js 16 APIs:

  - Use `src/proxy.ts` (replacing deprecated `middleware.ts`) to protect routes with Clerk while allowing `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/auth(.*)`, and `/api/proxy(.*)` through, excluding static assets in the matcher.
  - Ensure `params`, `searchParams`, `cookies()`, and `headers()` are `await`ed everywhere, and dynamic route handlers use `{ params }: { params: Promise<{ id: string }> }`.

- Configure `next.config.ts` with CSP (allowing `'self'`, Clerk, and Neon), HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and `COOP`/`CORP`.

- Build the dark glassmorphism design system in `src/app/globals.css` and `src/app/layout.tsx`: `#09090b` canvas with the three radial gradients (top-left emerald 12%, top-right teal 8%, bottom-center deep emerald 8%), 32px × 32px 3% white grid, glass/elevated-glass surfaces, custom 6px scrollbars, Geist/Inter + JetBrains Mono fonts, `<html lang="en" class="dark">`, `ClerkProvider`, metadata template `%s | Axiom`, OpenGraph/Twitter tags, and JSON-LD `SoftwareApplication`.

#### 2. Database Schema, Migrations & Idempotent Seed (`src/lib/db/*`, `src/lib/seed.ts`, `scripts/seed.ts`)

- Define PostgreSQL enums (`project_environment`, `member_role`, `agent_status`) and tables in `src/lib/db/schema.ts`:

  - `projects` (with unique `slug`, `environments` array, `encryption_algorithm`, timestamps)
  - `secrets` (with unique `(project_id, key, environment)`, `category`, `tags`, `version`, `is_ephemeral`, `expires_at`, `last_rotated_at`, `updated_by`)
  - `secret_versions` (with unique `(secret_id, version)`, immutable ciphertext snapshots, `comment`, `created_by`)
  - `team_members` (with unique `(project_id, user_id)`, `role`, `allowed_environments`)
  - `agent_harnesses` (with unique `api_key_alias`, `token_hash` SHA-256, `token_last_four`, `allowed_secrets`, `environment`, `status`, `ephemeral_ttl_minutes`, `token_limit_per_hour`, `tokens_used_today`, `auto_mask_secrets`, `expires_at`, `last_invoked`)
  - `activity_logs` (append-only audit rows with required `Action` values and indexes on `project_id` and `created_at`)
  - `project_settings` (`auto_backup_enabled`, Slack/Discord/PagerDuty webhooks, `require_mfa_for_production`, `enable_agent_proxy_firewall`, `master_key_fingerprint`, `audit_retention_days`)

- Configure `src/lib/db/index.ts` (`neon(process.env.DATABASE_URL!)` + `drizzle(sql, { schema })`) and `drizzle.config.ts` (`./drizzle`, `postgresql`, `dotenv` loading `.env.local`), generate initial SQL migrations in `drizzle/`, and create idempotent `src/lib/seed.ts` + `scripts/seed.ts` containing the `"Axiom Core Platform"` (`axiom-core`) project, 18+ secrets across `development`, `staging`, and `production` with version histories, 5 team members (`Alex Chen`, `Sarah Kim`, `Marcus Lee`, `Priya Nair`, `CI Deployer`), 3 agent harnesses (`Claude Code Proxy`, `AutoGPT Researcher`, `CI/CD Deployer`), 12+ activity log entries, and default settings.

#### 3. Server-Only Crypto, Pure Domain Helpers, Auth/RBAC & Audit (`src/lib/*`)

- `src/lib/crypto.ts` (`import 'server-only'`):

  - Validate `ENCRYPTION_MASTER_KEY` length (`>= 32` chars; fail fast with a clear error).
  - Derive and cache per-process a 256-bit key via PBKDF2-SHA256 (`>= 100,000` iterations, fixed app salt + key version byte).
  - AES-256-GCM encryption with random 12-byte IV (`crypto.randomBytes`), formatted as `v1:<base64(iv || authTag || ciphertext)>`, plus strict decryption that rejects tampered ciphertext or unsupported versions.
  - `maskSecret(value)`: values `<= 8` chars return all dots (`•` repeated); longer values return first 4 chars + 12 dots + last 4 chars.
  - CSPRNG token generation (`crypto.randomBytes`) for agent tokens (`axm_<48 hex>` and `axm_svc_live_<48 hex>`), SHA-256 hashing (`crypto.createHash('sha256')`), and constant-time comparisons (`crypto.timingSafeEqual`). Never use `Math.random()`.

- Pure modules:

  - `src/lib/diff.ts`: pure environment diff computation (`synced`, `missing_in_target`, `missing_in_source`, `value_mismatch`) over decrypted values on the server, deterministic union + sorting.
  - `src/lib/env-parse.ts`: pure `.env` parser handling blanks, `#` comments, `KEY=value`, `KEY="quoted"`, `KEY='single'`, CRLF, trimming, duplicates, and invalid keys (`^[A-Z][A-Z0-9_]*$`).

- `src/lib/auth.ts` & `src/lib/validators.ts`:

  - Server-side `auth()` check (`401` / unauthorized error if missing), `team_members` lookup by `(projectId, userId)`, role & `allowedEnvironments` enforcement, `requireMfaForProduction` check on production secret reveals, and append-only `recordAuditEvent(...)` helper.
  - Zod schemas enforcing key format/length (`<= 128`), value size (`<= 64KB`), descriptions/comments (`<= 2KB`), URL/webhook validation, and pagination/filter bounds.

#### 4. Server Actions, Proxy Route & Optional Parity API Routes

- Implement `src/lib/actions/projects.ts` covering all specified actions (`getCurrentProject`, `getProjectById`, `createProject`, `updateProject`, `getSecrets`, `getSecretById`, `createSecret`, `updateSecret`, `deleteSecret`, `rollbackSecret`, `getSecretVersions`, `syncSecretToEnv`, `syncEnvBatch`, `bulkImportSecrets`, `getTeamMembers`, `addTeamMember`, `removeTeamMember`, `updateTeamMemberRole`, `getAgentHarnesses`, `createAgentHarness`, `updateAgentStatus`, `triggerKillSwitch`, `rotateAgentToken`, `extendAgentTTL`, `getActivityLogs`, `exportActivityLogs`, `getProjectSettings`, `updateProjectSettings`, `rotateMasterKey`, `resetProjectToSeed`), each authenticating, validating with Zod, checking permissions, writing audit rows, and calling `revalidatePath('/dashboard')`.
- Implement `POST /api/proxy/[agentId]` (`src/app/api/proxy/[agentId]/route.ts`) with `Cache-Control: no-store`, Origin/`Sec-Fetch-Site` check, Bearer / `x-agent-key` token hash verification, status/TTL/quota (`429`)/rate-limit enforcement (auto-revoking expired harnesses), server-side secret decryption & count/masking metadata only (never returning plaintext values), simulated token usage increment (`150–450`), `lastInvoked` update, and `AGENT_ACCESS_GRANTED` audit logging.
- Add parity REST routes under `src/app/api/*` with consistent `{ error, code?, details? }` JSON and zero stack trace leakage.

#### 5. Landing Page, Command Palette & Six Dashboard Workspaces

- __Landing Page (`src/app/page.tsx` + `src/components/landing/*`)__: Server Component shell with client `ConsolePreview` (3 animated tabs: AI Agent Harness with killswitch simulation, Env Diff Sync with 1-Click Sync chip, Rollback Vault v3 vs v2) and copyable CLI snippet (`npx axiom init --project axiom-core`), plus sticky nav, hero, 6-card features grid, zero-trust diagram layout, 3-tier pricing, and footer.

- __Dashboard Shell & Command Palette (`src/app/dashboard/*`, `src/components/shell/*`, `src/components/command-palette.tsx`)__: Auth guard + auto-provisioned demo project on first sign-in, `AxiomProvider` (UI state only—never plaintext secrets), 256px desktop sidebar + 288px mobile drawer, sticky header with `?tab=` deep-linking and environment switcher, sonner toast wrapper, and `⌘K` / `Ctrl+K` command palette with ranking (`exact prefix > substring > description > tag`) and keyboard navigation.

- __Six Workspaces (`src/components/{secrets,diff,agents,team,activity,settings}/*`)__:

  - __Secrets Vault__: 4 stat cards, search + category filter chips, Add Secret, Bulk Import, Export `.env` (`${project.slug}.${env}.env`), table/mobile cards with reveal/copy/version/rotate/history/rollback/delete.
  - __Environment Diff__: Source/target env selectors + swap, stats & status filter chips, per-row reveal/copy/sync, and bulk Sync Missing / Fix Mismatches with confirmation.
  - __AI Agent Harness__: Stats, agent cards (TTL countdown, quota bar, alias copy, rotate token, +60m TTL, killswitch, status select), Create Agent dialog with one-time raw token reveal, and sticky Live Proxy Simulator with sequential 150ms terminal output.
  - __Team & RBAC__: Member list/cards, Invite Member dialog (owner/admin), inline role updates (preventing last-owner demotion), member removal (preventing self/last-owner removal), permission matrix legend, and Service Accounts token generator (`axm_svc_live_...`).
  - __Activity Audit__: Search + action/environment filters, append-only event stream with action icons/colors, CSV/JSON export (`axiom-audit-log-YYYY-MM-DD.csv|json`), and clear-filters empty state.
  - __Settings & KMS__: Master key rotation (updating fingerprint & re-encrypting snapshots without exposing keys), MFA & proxy firewall switches, audit retention (`30–365`), webhooks, Neon status card, dirty-state save, and owner-only Danger Zone reset.

- Every tab and list view will include loading skeletons, empty states with primary CTAs, and error states with retry.

#### 6. Documentation, Unit Tests & E2E Tests

- Write `README.md` (setup, environment variables, migrations, seeding, security model, demo flow) and `SECURITY.md` (threat model, envelope encryption, ephemeral tokens, membership checks, audit immutability, demo limitations).
- Implement Vitest unit tests in `tests/unit/*.test.ts` (secret masking, `.env` parser, diff engine, version increment & non-destructive rollback, AES-256-GCM round-trip/tamper/key validation, RBAC/environment permissions) and Playwright E2E specs in `tests/e2e/*.spec.ts`.
- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` once in Act mode.

<!-- END:nextjs-agent-rules -->
