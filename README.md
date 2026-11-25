# Axiom — Secrets Management for AI Agents

Zero-trust secrets management with built-in AI agent harness, environment diff sync, and KMS.

## Quick Start

```bash
# Clone and install
git clone <repo> && cd axiom
npm install

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and CLERK_* keys

# Run migrations & seed
npm run db:migrate
npm run db:seed

# Start development server
npm run dev
```

Open http://localhost:3000 (or 3001 if 3000 is in use).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Same as above for client |
| `ENCRYPTION_SECRET_KEY` | Yes | 32+ byte base64 key for AES-256-GCM |
| `NEXT_PUBLIC_APP_URL` | No | App URL for Clerk redirects (default: http://localhost:3000) |

## Database

- **ORM**: Drizzle with Neon serverless driver
- **Migrations**: `npm run db:migrate` (or `db:push` for dev)
- **Seed**: `npm run db:seed` creates demo project + secrets + agents

## Security Model

- **Envelope Encryption**: Master key (AES-256-GCM) encrypts DEKs; DEKs encrypt secret values
- **Ephemeral Agent Tokens**: Short-lived (default 60min), quota-limited, revocable via killswitch
- **RBAC**: Owner/Admin/Developer/Viewer/Agent roles with environment-scoped permissions
- **Audit Log**: Append-only, 30–365 day retention, CSV/JSON export
- **Zero-Downtime Key Rotation**: Re-encrypts all secrets without exposing plaintext

## Demo Flow

1. Sign up via Clerk → auto-provisions "Axiom Core" demo project
2. Visit **Secrets Vault** → add/edit secrets across dev/staging/prod
3. **Environment Diff** → compare dev vs prod, sync with one click
4. **AI Agent Harness** → create agent, copy token, watch live proxy simulator
5. **Team** → invite members, assign roles, create service accounts
6. **Activity** → filter audit log, export CSV/JSON
7. **Settings** → rotate master key, toggle MFA/firewall, configure webhooks

## Scripts

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run start        # Run production build
npm run lint         # ESLint
npm run typecheck    # TypeScript compile check
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright E2E tests
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Apply migrations
npm run db:push      # Push schema (dev)
npm run db:studio    # Drizzle Studio
npm run db:seed      # Seed demo data
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Landing page
│   ├── layout.tsx         # Root layout + providers
│   └── dashboard/         # Protected dashboard routes
│       ├── layout.tsx     # Shell (sidebar + header)
│       ├── page.tsx       # Overview
│       ├── secrets/       # Secrets Vault
│       ├── diff/          # Environment Diff
│       ├── agents/        # AI Agent Harness
│       ├── team/          # Team & RBAC
│       ├── activity/      # Activity Audit
│       └── settings/      # Settings & KMS
├── components/
│   ├── ui/                # shadcn/ui primitives (20+)
│   ├── shell/             # Sidebar, Header, CommandPalette
│   └── landing/           # ConsolePreview demo
├── lib/
│   ├── auth/rbac.ts       # Role/permission system
│   ├── crypto.ts          # AES-256-GCM encrypt/decrypt
│   ├── db/                # Drizzle schema + client
│   └── actions/           # Server Actions (mutations)
└── types/                 # Shared TypeScript types
```

## Production Checklist

- [ ] Rotate `ENCRYPTION_SECRET_KEY` to strong 32+ byte value
- [ ] Configure Clerk production instance
- [ ] Set up Neon production database
- [ ] Enable `cacheComponents` and `partialPrefetching` in next.config
- [ ] Configure webhook endpoints for audit events
- [ ] Set audit retention policy (30–365 days)
- [ ] Review RBAC permissions for your team structure