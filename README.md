# Northeast Watch

A situational-awareness dashboard for Northeast India (Assam, Meghalaya, Mizoram, Nagaland, Manipur, Tripura, Arunachal Pradesh, Sikkim): live weather and earthquake data, a real-time alert feed, and an integration framework for official disaster-management, river-level, and power-outage sources.

## Honest scope statement

This repository is a **complete, production-architected codebase** — real backend, real database schema, real security controls, real Docker/CI-CD — built to the standard described in `docs/PRODUCTION_CHECKLIST.md`. What it is **not**: a system that has been deployed, load-tested, or verified to hold 100,000 concurrent users. That verification requires real cloud infrastructure and a load-testing pass that can only happen after deployment — see `docs/VERIFICATION_CHECKLIST.md` for exactly what to run and what "done" looks like.

It's also honest about data sources: **weather and earthquakes are real, live data** (Open-Meteo and USGS — free, public, no API key). Flood/landslide bulletins, river levels, road closures, and power outages have **no free public API** in this domain, so instead of faking that data, the backend implements the full integration point (HTTP client, auth, retry, idempotent ingestion, webhook receiver with HMAC verification) and reports those sources as "not configured" until an operator supplies real credentials. See `docs/INTEGRATIONS.md`.

## Repository layout

```
apps/
  api/    Node.js + TypeScript backend (Express, Prisma/Postgres, Redis, BullMQ, WebSocket)
  web/    React + TypeScript frontend (Vite, Tailwind, MapLibre, TanStack Query, Zustand)
infra/
  docker-compose.yml         local dev stack
  docker-compose.prod.yml    production overlay (Nginx, replicas, resource limits)
  nginx/                     reverse proxy config, TLS, security headers, WebSocket upgrade
.github/workflows/ci.yml     lint -> typecheck -> test -> build -> push -> deploy
docs/                        architecture, deployment, security, integrations, checklists
```

## Quick start (local development)

```bash
# 1. Start Postgres + Redis
docker compose -f infra/docker-compose.yml up -d postgres redis

# 2. Backend
cd apps/api
cp .env.example .env          # then fill in real secrets — see comments in the file
npm install
npm run db:migrate:dev
npm run db:seed
npm run dev                   # http://localhost:4000

# 3. Frontend (separate terminal)
cd apps/web
npm install
npm run dev                   # http://localhost:5173
```

Full production deployment steps: `docs/DEPLOYMENT.md`.

## Documentation index

- `docs/ARCHITECTURE.md` — system design, data flow, scaling approach
- `docs/DEPLOYMENT.md` — step-by-step production deployment, TLS, backups
- `docs/SECURITY.md` — auth model, threat mitigations, secrets handling
- `docs/INTEGRATIONS.md` — how to connect ASDMA/CWC/APDCL/news sources for real
- `docs/PRODUCTION_CHECKLIST.md` — what's done, what's configuration, what's your call
- `docs/VERIFICATION_CHECKLIST.md` — how to actually prove this holds 100k users
