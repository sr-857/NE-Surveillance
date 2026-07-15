# Architecture

## System overview

```
                        ┌─────────────┐
                        │   Browser   │
                        └──────┬──────┘
                               │ HTTPS + WSS
                        ┌──────▼──────┐
                        │    Nginx    │  TLS termination, static files,
                        │ (reverse    │  rate limiting at the edge,
                        │  proxy/LB)  │  load-balances across API replicas
                        └──────┬──────┘
                               │
                 ┌─────────────┼─────────────┐
                 ▼             ▼             ▼
            ┌─────────┐  ┌─────────┐  ┌─────────┐
            │  API #1 │  │  API #2 │  │  API #3 │   stateless Node.js/Express
            └────┬────┘  └────┬────┘  └────┬────┘   instances — any replica can
                 │            │            │         serve any request
                 └──────┬─────┴─────┬──────┘
                         ▼           ▼
                  ┌───────────┐ ┌─────────┐
                  │ PostgreSQL│ │  Redis  │  cache, rate-limit state,
                  │ (primary) │ │         │  pub/sub, job queue
                  └───────────┘ └─────────┘
                         ▲
                         │
              ┌──────────┴──────────┐
              │   Scheduler (cron)  │  runs inside one API instance per tick,
              │  + BullMQ workers   │  coordinated via a Redis lock (see
              └──────────┬──────────┘  jobs/scheduler.ts)
                         │
        ┌────────────────┼────────────────┬───────────────┐
        ▼                ▼                ▼               ▼
   Open-Meteo         USGS            ASDMA/CWC/APDCL   Webhook receiver
   (weather, live)  (earthquakes,     (configurable,     (partner-pushed
                      live)           see INTEGRATIONS)   bulletins)
```

## Why stateless API instances

Every API instance is interchangeable — no in-memory session state, no
in-memory rate-limit counters, no in-memory websocket-only broadcast. This is
what makes horizontal scaling (`docker compose up --scale api=N`, or N pods in
Kubernetes) actually correct rather than just "technically running multiple
copies":

- **Auth**: JWT access tokens are stateless (verified with a shared secret,
  not looked up in memory). Refresh tokens are looked up in Postgres, so
  revocation works identically no matter which instance handles the request.
- **Rate limiting**: state lives in Redis (`middleware/rateLimit.ts`), so a
  client gets N requests total across the fleet, not N-per-replica.
- **WebSocket broadcast**: a new alert ingested by instance #2 needs to reach
  a browser connected to instance #1. This works via Redis pub/sub
  (`websocket/server.ts` subscribes, `alerts.service.ts` publishes) — every
  instance rebroadcasts to its own locally-connected clients.
- **Scheduled jobs**: cron would otherwise fire the same job N times per tick
  across N replicas. A short Redis lock (`SET NX PX`) ensures only one
  instance's cron tick actually executes per interval (`jobs/scheduler.ts`).

## Data flow: how an alert reaches a browser

1. **Live sources** (USGS) are polled every 1 minute by the scheduler
   (`jobs/scheduler.ts` → `alerts.service.ts pollAllAdapters()`).
2. **Partner sources** (ASDMA/CWC/APDCL, once configured) can either be
   polled the same way, or push bulletins to `POST /api/webhooks/:key`
   (HMAC-signature-verified), which enqueues a BullMQ job rather than
   blocking the HTTP response.
3. Either path calls `upsertAlert()`, which is idempotent (unique constraint
   on `[sourceType, sourceName, externalId]`) — re-polling never creates
   duplicates, and updates refresh severity/expiry on existing alerts.
4. A genuinely **new** alert publishes to the `alerts:new` Redis channel.
5. Every API instance's websocket layer is subscribed to that channel and
   pushes to its locally-connected clients whose subscription filter matches
   the alert's region.
6. The frontend (`hooks/useLiveAlerts.ts`) doesn't try to merge the pushed
   payload into its local cache by hand — it invalidates the TanStack Query
   cache for `['alerts']`, triggering a normal refetch. Simpler, and
   guaranteed to match what a fresh page load would show.

## Caching strategy

- **Weather**: Redis cache-aside with a 5-minute TTL matching the refresh
  cadence (`lib/redis.ts cached()`), backed by a durable Postgres history
  table (`WeatherSnapshot`) for trend charts — Redis is a performance layer,
  Postgres is the source of truth for anything that needs to survive a cache
  eviction or a Redis restart.
- **Rate limiting**: Redis is the primary store; if Redis is unreachable, the
  limiter degrades to a best-effort in-memory limiter rather than either
  failing open (no protection) or failing closed (API goes down because
  Redis had a blip).

## Why Prisma + Postgres

Typed queries end-to-end (the same `Alert` type flows from the database
through the service layer to the API response), migrations as code, and a
schema that documents its own constraints (unique indexes enforcing
idempotent ingestion, foreign keys enforcing that alerts can't reference a
region that doesn't exist). See `apps/api/src/db/prisma/schema.prisma` — it's
extensively commented with the reasoning behind each modeling choice.

## Scaling beyond this repo's docker-compose

`infra/docker-compose.prod.yml` demonstrates the *shape* of horizontal
scaling (N stateless replicas + shared Postgres/Redis + Nginx LB) on a single
host. For real 100k-user scale, the natural next steps are:

- Move Postgres to a managed service with read replicas (RDS/Cloud SQL) —
  the codebase already separates reads that could be served from a replica
  (weather/alerts listing) from writes that need the primary.
- Move Redis to a managed cluster (ElastiCache/Memorystore) with
  persistence enabled for the job queue.
- Replace the static Nginx `upstream` block with a real orchestrator
  (Kubernetes Service + HPA, or an ALB + ECS service) for actual elastic
  autoscaling — see the note in `infra/nginx/nginx.conf`.
- Put a CDN in front of the static frontend build and set long cache
  lifetimes on hashed asset filenames (already configured in the Nginx
  `location /assets/` block — point a CDN at origin and it just works).
