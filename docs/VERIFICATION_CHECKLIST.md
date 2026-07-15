# Verification checklist — proving this holds 100,000 users

Nobody can honestly claim a system "supports 100,000 users" without having
run something against it. This is the concrete list of what to run, in
order, after deployment — each with a specific pass/fail bar, not just
"test it."

## 1. Functional correctness first (before any load test)

- [ ] `npm test` passes in CI against real Postgres/Redis (already wired —
      confirm it's green on `main`).
- [ ] Manually walk the full auth flow in a real browser: register → login
      → refresh (wait 15+ min, confirm silent refresh works) → logout →
      confirm the refresh cookie is actually cleared.
- [ ] Confirm `GET /api/alerts/integrations/status` correctly reports
      `configured: false` for every integration you haven't set up yet, and
      that the dashboard shows "not connected" rather than an empty list
      that looks like "no hazards."
- [ ] Kill the API process mid-request (`docker kill` a replica) and confirm
      the load balancer routes around it and in-flight requests to *other*
      replicas are unaffected.

## 2. Load testing

Use [k6](https://k6.io/), [Artillery](https://www.artillery.io/), or
[Gatling](https://gatling.io/) against a **staging environment that mirrors
production sizing** — never load-test against production for the first time.

Minimum scenarios to run:

- [ ] **Read-heavy baseline**: simulate the dashboard's actual polling
      pattern (`GET /api/weather` every 5 min, `GET /api/alerts` every 1
      min per connected client) at 10,000 concurrent virtual users. Target:
      p95 latency < 300ms, zero 5xx errors.
- [ ] **Ramp to 100,000**: ramp virtual users from 1,000 to 100,000 over 10
      minutes, hold for 15 minutes. Watch: CPU/memory on each API replica,
      Postgres connection pool saturation, Redis memory, Nginx worker
      connections. Target: error rate stays under 0.1%, p99 latency stays
      under 1s.
- [ ] **WebSocket connection scale**: open 20,000+ concurrent WebSocket
      connections (a realistic fraction of 100k HTTP users keeping the
      dashboard open) and confirm memory per API replica scales linearly,
      not exponentially — each connection is one entry in an in-process
      `Map`, so this should be roughly linear. Measure actual memory-per-
      connection and use it to size replica count/memory limits.
- [ ] **Auth endpoint stress**: hammer `/api/auth/login` specifically —
      confirm the stricter auth rate limiter (10 req/min per IP) actually
      kicks in and protects bcrypt (which is deliberately slow) from
      becoming a CPU-exhaustion vector.
- [ ] **Database connection exhaustion**: confirm Prisma's connection pool
      size × number of API replicas doesn't exceed Postgres's
      `max_connections` — this is a common "worked in staging with 2
      replicas, fell over in production with 20" bug. Use PgBouncer in
      transaction-pooling mode if you need more replicas than direct
      connections comfortably support.

## 3. Failure injection (chaos-lite)

- [ ] Stop Redis for 60 seconds while under load. Confirm: rate limiting
      degrades to in-memory (doesn't crash), weather/alert reads degrade to
      direct-provider calls (slower, not broken), the app recovers cleanly
      when Redis returns.
- [ ] Stop one of N API replicas under load. Confirm zero user-visible
      errors (the LB should route around it within its health-check
      interval).
- [ ] Simulate the USGS or Open-Meteo API being down (block the domain at
      the network level on one replica). Confirm the scheduler logs the
      failure and retries next cycle, and that stale-but-present cached
      data is still served rather than the endpoint 500ing.

## 4. Security verification

- [ ] Run `npm audit` (or Snyk) against both `apps/api` and `apps/web` —
      zero high/critical vulnerabilities before go-live.
- [ ] Confirm HTTPS is actually enforced (HTTP requests 301 to HTTPS, HSTS
      header present) using `curl -I http://your-domain`.
- [ ] Run an automated scan (OWASP ZAP baseline scan, minimum) against
      staging.
- [ ] Have someone who didn't write this code attempt basic abuse: reused
      refresh tokens, role-tampering in the JWT (should fail signature
      verification), SQL-injection-shaped input in every text field
      (should fail Zod validation or be safely parameterized by Prisma).

## 5. Observability sign-off

- [ ] Confirm structured logs are actually flowing into your log
      aggregation system (Loki/ELK/Datadog/CloudWatch) from all replicas,
      with the `requestId` correlation field intact end-to-end.
- [ ] Confirm `/health/ready` is what your load balancer/orchestrator
      actually checks (not `/health/live`, which doesn't check
      dependencies) — a common misconfiguration that lets a DB-disconnected
      replica keep receiving traffic.
- [ ] Set up an actual alert (PagerDuty/Opsgenie/etc.) on: error rate
      spike, p99 latency spike, `/health/ready` returning 503, disk usage
      on the Postgres host.

## What "verified for 100k users" actually means

Not "the architecture supports it in principle" — that's
`docs/ARCHITECTURE.md`, and it's a design claim, not a measurement. It means
every box above is checked, with the actual numbers (p50/p95/p99 latency,
error rate, replica count, resource usage at peak) written down somewhere
your team can reference — a load test result that nobody wrote down might as
well not have happened.
