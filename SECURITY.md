# Security Documentation — Axiom

## Threat Model

| Threat | Mitigation |
|--------|------------|
| **Secret exfiltration at rest** | AES-256-GCM envelope encryption; master key never written to DB |
| **Secret exfiltration in transit** | TLS 1.3 enforced; internal service-to-service mTLS |
| **Insider access to production secrets** | RBAC + environment-scoped permissions; MFA required for prod |
| **Compromised agent token** | Ephemeral TTL (default 60min), quota limits, instant killswitch |
| **Replay attacks on API** | Nonce + timestamp validation on agent proxy |
| **Audit log tampering** | Append-only DB table; no UPDATE/DELETE permissions for app role |
| **Key compromise** | Zero-downtime master key rotation re-encrypts all secrets |
| **Supply chain** | Pinned dependencies; `npm audit` in CI; SBOM generation |

---

## Envelope Encryption

```
┌─────────────────────────────────────────────────────────────┐
│                    MASTER KEY (AES-256-GCM)                  │
│  Stored in env var ENCRYPTION_SECRET_KEY (32+ bytes b64)   │
└──────────────────────────┬──────────────────────────────────┘
                           │ encrypts
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  DATA ENCRYPTION KEYS (DEKs)                │
│  One per secret; stored encrypted in `secrets.value`       │
└──────────────────────────┬──────────────────────────────────┘
                           │ encrypts
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      SECRET VALUES                          │
│  Plaintext only exists in memory during decrypt()          │
└─────────────────────────────────────────────────────────────┘
```

**Key Derivation**: `scrypt(password=ENCRYPTION_SECRET_KEY, salt="axiom-salt", N=32768, r=8, p=1, dkLen=32)`

**Ciphertext Format**: `iv:authTag:ciphertext` (all hex)
- IV: 16 bytes random per encryption
- AuthTag: 16 bytes GCM authentication tag
- Ciphertext: variable length

---

## Ephemeral Agent Tokens

```
Token Format: axm_<prefix>_<24-byte-random>
Example:     axm_cod_abcdef1234567890abcdef
```

| Property | Default | Configurable |
|----------|---------|--------------|
| TTL | 60 minutes | 5–10080 min (1 week) |
| Quota | 50,000 tokens/hr | 1,000–1,000,000 |
| Scope | Per-agent secret allowlist | Subset of project secrets |
| Status | active / sandboxed / revoked / rate_limited | Manual or auto |

**Validation Flow**:
1. Split token on `_` → extract prefix
2. Look up `agent_harnesses` by `token_prefix`
3. Verify `status === 'active'` and `expires_at > now()`
4. Hash full token with SHA-256 → compare to stored `token_hash`
5. Check `tokens_used_today < token_limit_per_hour`
6. Increment counter; return allowed secrets (decrypted)

---

## Membership & Permission Checks

```typescript
// Server-side guard (every mutation)
const user = await getCurrentUser();
authorize(user, "secret:write");  // throws if denied

// Role hierarchy: viewer < developer < admin < owner
// Agent role is special: only 'agent:invoke' permission

// Environment scoping
if (!user.allowedEnvironments.includes(targetEnv)) {
  throw new Error("Not authorized for this environment");
}
```

**Critical Invariants**:
- Last owner cannot be demoted or removed
- Users cannot self-remove
- Service accounts (role: agent) cannot manage team

---

## Audit Log Immutability

```sql
-- append-only table (no UPDATE/DELETE grants for app role)
CREATE TABLE activity_logs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,  -- from fixed enum
  resource_name TEXT NOT NULL,
  environment TEXT NOT NULL,
  details TEXT DEFAULT '',
  ip_address TEXT DEFAULT '127.0.0.1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Retention policy enforced by pg_cron job
DELETE FROM activity_logs
WHERE created_at < NOW() - INTERVAL '<retention_days> days';
```

**Export**: CSV/JSON includes all columns; PII (IP, email) included for compliance.

---

## Demo Limitations (Known Gaps)

| Area | Limitation | Production Fix |
|------|------------|----------------|
| **Master Key** | Single key in env var | HSM / Cloud KMS (AWS KMS, GCP KMS, Azure Key Vault) |
| **Key Rotation** | Re-encrypts all secrets synchronously | Background job with progress tracking |
| **Agent Proxy** | Simulated terminal output | Real HTTP proxy with domain allowlist |
| **MFA** | Toggle only (no TOTP enforcement) | Enforce WebAuthn/TOTP via Clerk |
| **Audit Retention** | Manual pg_cron job | Managed cron with monitoring/alerts |
| **Secret Rotation** | Manual version bump | Automated rotation schedules + notifications |
| **Backup** | None implemented | Point-in-time recovery + cross-region replica |

---

## Incident Response

1. **Compromised Agent Token** → Kill switch in UI or `POST /api/agents/:id/kill-switch`
2. **Compromised Master Key** → Rotate immediately via Settings → KMS; all secrets re-encrypted
3. **Suspected Data Exfiltration** → Export audit log; review `SECRET_READ` events for anomalies
4. **Insider Threat** → Revoke team member access; rotate affected secrets; audit `SECRET_*` events

---

## Compliance Notes

- **SOC 2 Type II**: Audit log + RBAC + encryption at rest/in transit satisfy CC6.1, CC6.7
- **GDPR**: No personal data in secrets; audit log emails are access-control metadata
- **HIPAA**: Not certified; would require BAA with Neon + Clerk + infrastructure
- **PCI DSS**: Secrets can store card tokens; network segmentation required