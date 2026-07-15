# Production checklist

Three categories, on purpose: things that are genuinely done in this
codebase, things that are done but need YOUR values (config/credentials/infra
choices), and things that are explicitly out of scope for a codebase to
"include." Treating all three as one undifferentiated checklist is how teams
end up thinking something is production-ready when it's actually waiting on
a decision only they can make.

## ✅ Done — in the code, verified

- [x] Strict TypeScript across backend and frontend (`strict: true`,
      `noUncheckedIndexedAccess`, `noUnusedLocals`, etc.)
- [x] Zod validation on every request body/query/params
- [x] Password hashing (bcrypt, cost 12), constant-shape login failure path
- [x] JWT access + rotating refresh tokens with reuse detection
- [x] RBAC (ADMIN/ANALYST/VIEWER) enforced per-route
- [x] Envelope encryption (AES-256-GCM) for partner integration credentials
- [x] Append-only audit log for security-relevant actions
- [x] Redis-backed rate limiting (correct across horizontally-scaled
      instances), with in-memory fallback if Redis is unreachable
- [x] Helmet CSP, CORS allowlist, HSTS, security headers (app + Nginx layers)
- [x] Structured logging (pino) with secret redaction
- [x] Liveness + readiness health checks
- [x] Idempotent alert ingestion (unique constraint, safe to re-poll)
- [x] Real live integrations: Open-Meteo (weather), USGS (earthquakes) —
      verified against known endpoints before being wired in
- [x] Documented, working integration adapter pattern for partner sources
      that need real credentials (ASDMA/CWC/APDCL) — returns empty, never
      fabricated data, when unconfigured
- [x] HMAC-signature-verified webhook receiver + async queue processing
      (BullMQ) for partner-pushed data
- [x] Database schema with proper constraints, indexes, and cascade rules
      (Prisma), plus a seed script for reference data
- [x] Graceful shutdown (SIGTERM/SIGINT drain connections, close DB/Redis,
      stop cron before exiting)
- [x] Multi-stage, non-root, health-checked Dockerfiles for both apps
- [x] CI pipeline: lint, format check, typecheck, tests against real
      Postgres/Redis, Docker build, image push
- [x] Unit tests (crypto, RBAC) and integration tests (full auth flow
      including refresh rotation reuse-detection) against a real database
- [x] Dark/light theme, keyboard-accessible forms, `prefers-reduced-motion`
      respected, semantic ARIA labels on the map markers

## ⚙️ Done, but needs YOUR values before it's live

- [ ] Generate real secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
      `CREDENTIAL_ENCRYPTION_KEY`) and load them via a real secrets manager
      — see `docs/DEPLOYMENT.md` step 1.
- [ ] Point `CORS_ALLOWED_ORIGINS` at your real frontend domain(s).
- [ ] Obtain and install real TLS certificates (`docs/DEPLOYMENT.md` step 2).
- [ ] Configure real ASDMA/CWC/APDCL credentials once you have partnership
      agreements with those agencies (`docs/INTEGRATIONS.md`).
- [ ] Point the map tile `style` URL at a production tile provider —
      the MapLibre demo endpoint in the scaffold is dev-only
      (`docs/DEPLOYMENT.md` "Map tiles").
- [ ] Set up a real error-tracking DSN (`SENTRY_DSN` is wired into env
      validation but no Sentry SDK call is added yet — add
      `@sentry/node`/`@sentry/react` init calls if you want it).
- [ ] Wire the CI `deploy` job to your actual infrastructure
      (`.github/workflows/ci.yml` — currently a documented placeholder).

## 🚧 Explicitly out of scope for a codebase — organizational/infra decisions

- [ ] Actually provisioning cloud infrastructure (this repo doesn't and
      shouldn't assume AWS vs GCP vs on-prem for you).
- [ ] Load testing at 100k-user scale — see `docs/VERIFICATION_CHECKLIST.md`.
      A codebase can be *architected* for this; only a real load test against
      real infrastructure *proves* it.
- [ ] Third-party security audit / penetration test before handling real
      public-safety data.
- [ ] Legal/data-sharing agreements with ASDMA, CWC, APDCL, or any other
      government body whose data you plan to integrate.
- [ ] MFA enrollment flow (schema fields reserved, flow not implemented —
      see `docs/SECURITY.md` "Known gaps").
- [ ] `npm audit`/Dependabot wired into CI (not currently in
      `.github/workflows/ci.yml` — straightforward to add, not yet done).
- [ ] Uptime monitoring / on-call paging (PagerDuty, Better Uptime, etc.) —
      the `/health/*` endpoints exist for exactly this, but the monitoring
      service itself is a subscription you set up, not code.
