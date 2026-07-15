# Deployment guide

## Prerequisites

- A Linux host (or hosts) with Docker + Docker Compose v2, OR a Kubernetes
  cluster if you're going that route (see "Beyond docker-compose" below).
- A domain name pointed at the host, for TLS.
- Managed or self-hosted PostgreSQL 16+ and Redis 7+ (docker-compose brings
  its own for convenience; for real production, a managed service — RDS,
  Cloud SQL, ElastiCache — is strongly recommended over self-hosting these).

## 1. Generate secrets

```bash
openssl rand -hex 32   # JWT_ACCESS_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET (must be different from the above)
openssl rand -hex 32   # CREDENTIAL_ENCRYPTION_KEY
```

Put these in your secrets manager, not in a committed file. `apps/api/.env`
is git-ignored — use it only for local dev.

## 2. TLS certificates

```bash
# Using certbot (Let's Encrypt) on the host, before starting Nginx:
certbot certonly --standalone -d app.northeastwatch.example
cp /etc/letsencrypt/live/app.northeastwatch.example/fullchain.pem infra/nginx/certs/
cp /etc/letsencrypt/live/app.northeastwatch.example/privkey.pem infra/nginx/certs/
```

Set up renewal via cron (`certbot renew`) plus an Nginx reload — certbot's
`--deploy-hook` option handles this cleanly:

```bash
certbot renew --deploy-hook "docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml exec nginx nginx -s reload"
```

## 3. Database migration

```bash
cd apps/api
DATABASE_URL="postgresql://..." npm run db:migrate:deploy
DATABASE_URL="postgresql://..." npm run db:seed   # idempotent — safe to re-run
```

`db:migrate:deploy` (unlike `db:migrate:dev`) never prompts and never
generates new migrations — it only applies existing ones, which is what you
want in CI/production.

## 4. Build and deploy

```bash
cd infra
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  up -d --build --scale api=3
```

This brings up Postgres, Redis, 3 API replicas, and Nginx. Verify:

```bash
curl https://app.northeastwatch.example/health/ready
```

## 5. CI/CD

`.github/workflows/ci.yml` runs lint → typecheck → test (against real
Postgres/Redis service containers) → Docker build → push to
`ghcr.io/<repo>/api`. The final `deploy` job is intentionally a placeholder —
wire in whichever of these matches your infrastructure:

- **SSH + compose**: `ssh host "docker compose pull && docker compose up -d"`
- **Kubernetes**: `kubectl set image deployment/api api=ghcr.io/.../api:$SHA`
- **AWS ECS**: `aws ecs update-service --force-new-deployment`

Store the credentials for whichever path you pick as GitHub Environment
secrets scoped to the `production` environment (already referenced in the
workflow's `deploy` job).

## Backup and recovery

- **Database**: automated daily `pg_dump` to encrypted object storage
  (S3/GCS with SSE), retained 30 days, plus point-in-time recovery if using
  a managed Postgres (RDS/Cloud SQL both support this natively — prefer
  that over rolling your own WAL archiving).
  ```bash
  pg_dump "$DATABASE_URL" | gzip | aws s3 cp - s3://your-backup-bucket/nw-$(date +%F).sql.gz
  ```
- **Redis**: treat as a cache/queue, not a source of truth — the only
  durable state in Redis is in-flight BullMQ jobs, which are designed to be
  safely retryable. Enable RDB snapshotting if you want faster recovery
  after a restart, but a total Redis loss should never lose data, only
  in-flight jobs (which the affected integration's next poll cycle would
  naturally re-fetch).
- **Recovery drill**: actually restore a backup into a scratch database at
  least quarterly. An untested backup is a hypothesis, not a backup.

## Map tiles

The frontend scaffold uses MapLibre's free public demo style
(`https://demotiles.maplibre.org/style.json`) — fine for development, **not**
appropriate for production traffic (it's a shared demo endpoint with no
uptime guarantee). Before going live, point `RegionMap.tsx`'s `style` at:

- A paid provider (MapTiler, Stadia Maps, Mapbox) — simplest, has a free
  tier that likely covers early traffic.
- A self-hosted tile server (e.g. `tileserver-gl` + OpenStreetMap extract)
  if you want full control and no per-request cost at scale.

## Beyond docker-compose

For genuine 100k-user, thousands-of-concurrent-users scale, the natural
migration path is:

1. Managed Postgres with a read replica (route `GET` endpoints in
   `weather.routes.ts`/`alerts.routes.ts` to the replica).
2. Managed Redis cluster.
3. Kubernetes (or ECS) instead of docker-compose, with a Horizontal Pod
   Autoscaler on the API deployment keyed on CPU/request latency, and a
   real load balancer (ALB/GCLB) instead of the static Nginx `upstream`
   block.
4. A CDN in front of the frontend static assets (already cache-header-ready,
   see `infra/nginx/conf.d/default.conf`'s `/assets/` block).

None of this is code-level work — the application is already stateless and
horizontally scalable (see `docs/ARCHITECTURE.md`); it's infrastructure
provisioning, which is intentionally outside what a codebase can "include."
