# Security

## Authentication

- Passwords hashed with **bcrypt**, cost factor 12.
- **Access tokens**: short-lived (15 min default) JWTs, signed with a 256-bit
  secret, verified statelessly (no DB lookup needed on every request).
- **Refresh tokens**: opaque random values (not JWTs), stored **hashed**
  (SHA-256) in Postgres — a database leak doesn't expose usable tokens.
  Delivered via an `httpOnly`, `Secure`, `SameSite=Strict` cookie scoped to
  `/api/auth` — JavaScript can never read it, which is the actual defense
  against token theft via XSS (see `lib/crypto.ts`, `modules/auth/*`).
- **Rotation with reuse detection**: every refresh consumes the presented
  token and issues a new one in the same "family". If a *revoked* token is
  ever presented again (someone replaying a stolen token after the real
  client already rotated past it), the entire family is revoked and an
  audit event is recorded. This is the standard mitigation for refresh
  token theft (see `auth.service.ts refresh()`).
- Login has a **constant-shape failure path**: even when the email doesn't
  exist, a bcrypt compare still runs (against a dummy hash) so response
  timing doesn't leak which emails are registered.
- Self-registration always grants the `VIEWER` (read-only) role. Role
  elevation is an explicit `ADMIN`-only action (`PATCH
  /api/admin/users/:id/role`) — never something a client can request for
  itself at signup.

## Authorization

Role hierarchy: `ADMIN > ANALYST > VIEWER`, enforced by
`middleware/rbac.ts requireRole()`. Every route that mutates state declares
its minimum required role explicitly at the route definition — there's no
implicit "authenticated users can do X" default.

## Input validation

Every request body/query/params that reaches a handler has been parsed (not
just checked) by a Zod schema (`middleware/validate.ts`), which replaces
`req.body` etc. with the validated, type-coerced result. Handlers never see
unvalidated input — this is also what prevents SQL injection in practice:
Prisma's parameterized queries handle the query layer, and Zod ensures
malformed types never reach that layer in the first place.

## Transport & headers

- HTTPS enforced end-to-end: Nginx terminates TLS and redirects all HTTP to
  HTTPS; `Strict-Transport-Security` set for 2 years with `preload`.
- **CSP**: `default-src 'self'`, no inline scripts, `frame-ancestors 'none'`
  (clickjacking protection) — see `app.ts` helmet config.
- **CORS**: explicit origin allowlist from `CORS_ALLOWED_ORIGINS`, credentials
  enabled only for those origins.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin` set at both the app and
  Nginx layers (defense in depth).

## CSRF

Because the refresh token cookie is `SameSite=Strict`, it is never sent on a
cross-site request in the first place — the browser simply won't attach it,
which closes the classic CSRF vector for the auth flow without needing a
separate CSRF token. Mutating API routes additionally require a valid
`Authorization: Bearer` header (not just a cookie), which a cross-site form
POST cannot forge.

## Rate limiting

Two layers:
1. **Nginx**, at the edge — coarse, cheap, protects against basic flooding
   before it even reaches the app (`infra/nginx/conf.d/default.conf`).
2. **Application**, Redis-backed (`middleware/rateLimit.ts`) — correct
   across every horizontally-scaled instance (state isn't per-process), with
   a stricter limiter specifically on `/api/auth/*` to slow down credential
   stuffing.

## Secrets management

- No secret is ever hardcoded. `config/env.ts` validates every required
  secret at boot via Zod and **crashes immediately** with a clear error if
  misconfigured — a missing production secret is a startup failure, not a
  silent vulnerability.
- **Partner integration credentials** (ASDMA/CWC/APDCL API keys) are
  encrypted at the application layer with **AES-256-GCM** before being
  stored in Postgres (`lib/crypto.ts encryptSecret/decryptSecret`) — even a
  full database dump doesn't expose usable credentials without the separate
  `CREDENTIAL_ENCRYPTION_KEY`, which should live in a proper secrets
  manager (see below), not in the same place as the database backup.
- In production, inject all secrets via your platform's secrets manager
  (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault, or at minimum
  Docker/Kubernetes secrets) — never via a committed `.env` file. `.env` is
  git-ignored in this repo; `.env.example` documents the shape without real
  values.

## Audit logging

Every security-relevant action (`login`, `login_failed`,
`refresh_token_reuse_detected`, `role_changed`, `integration.credential_updated`,
`alert.manual_create`, etc.) is written to an **append-only** `AuditLog`
table (`modules/audit/audit.service.ts`) — never updated or deleted by
application code. Audit writes are best-effort relative to the action they
record (a logging failure never blocks or rolls back the underlying action),
but failures are logged loudly so an operator notices coverage gaps.

## Logging & data handling

Structured logging via `pino` (`lib/logger.ts`) with an explicit `redact`
list — `Authorization` headers, cookies, password hashes, token hashes, and
encrypted credential blobs are never written to logs, even accidentally via
object spreading.

## Known gaps / next steps for a real deployment

Being direct about what this scaffold does *not* yet include, so nothing
here is mistaken for "done":

- **MFA**: the schema has `mfaEnabled`/`mfaSecret` fields reserved, but the
  enrollment/verification flow itself isn't implemented yet.
- **Dependency scanning**: add `npm audit` / Snyk / Dependabot to CI before
  going live — not currently wired into `.github/workflows/ci.yml`.
- **Penetration testing**: this document describes the mitigations that were
  *designed in*; it is not a substitute for an actual security review before
  handling real public-safety data at scale.
- **WAF**: consider a managed WAF (Cloudflare, AWS WAF) in front of Nginx
  for production, especially given this is a public-safety-adjacent tool
  that may attract abuse during real emergencies.
