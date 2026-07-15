# Integrations runbook

This is the honest map of every data module: what's live today, what needs a
real credential, and exactly what to do to connect it.

## Already live — nothing to configure

| Module | Source | Notes |
|---|---|---|
| Weather | [Open-Meteo](https://open-meteo.com) | Free, no API key, CORS-open. Polled every 5 min (`jobs/scheduler.ts`). |
| Earthquakes | [USGS Earthquake Hazards Program](https://earthquake.usgs.gov) | Free, no API key. Filtered to the NE India bounding box. Polled every 1 min. |

## Needs a real credential — adapter is built, waiting for you

These hazard categories genuinely have no standardized free public API — each
state disaster management authority, the Central Water Commission, and each
power utility publish bulletins through their own systems (often a website,
sometimes an RSS feed, occasionally a proper API for registered partners).
The backend's `createGenericHttpHazardAdapter` (see
`modules/alerts/adapters/genericHttpHazard.adapter.ts`) is a fully working
HTTP client — auth header injection, timeout handling, idempotent
normalization — that just needs an endpoint and key.

### 1. Configure the credential (as an ADMIN)

```bash
curl -X PUT https://your-domain/api/admin/integrations/asdma_bulletins \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Assam State Disaster Management Authority",
    "baseUrl": "https://asdma.example.gov.in/api/bulletins/active",
    "apiKey": "the-key-they-issued-you"
  }'
```

Repeat for `cwc_river_levels` and `apdcl_outages` with their respective
endpoints. The key is encrypted (AES-256-GCM) before it touches the
database — see `docs/SECURITY.md`.

### 2. Match the response shape (or write a small transform)

The adapter expects the upstream JSON to look like:

```json
{
  "items": [
    {
      "id": "asdma-2026-04521",
      "regionCode": "ASM",
      "hazardType": "FLOOD",
      "severity": "WARNING",
      "title": "River level approaching danger mark near Guwahati",
      "description": "...",
      "effectiveAt": "2026-07-15T04:00:00Z",
      "expiresAt": "2026-07-16T04:00:00Z",
      "bulletinUrl": "https://asdma.example.gov.in/bulletins/4521"
    }
  ]
}
```

If the real upstream schema differs (it will), write a small
`transformResponse` function and pass it when constructing the adapter in
`modules/alerts/adapters/index.ts` — the adapter factory takes it as an
optional parameter specifically for this. `regionCode` must match a seeded
`Region.code` (see `db/prisma/seed.ts` for the full list of state/district
codes).

### 3. Alternative: have them push to you instead of polling

If the partner can call out to you (many government integration teams
prefer this), point them at:

```
POST /api/webhooks/asdma_bulletins
X-Signature: <hex-encoded HMAC-SHA256 of the raw JSON body, using the same apiKey as the secret>
Content-Type: application/json

{ "id": "...", "regionCode": "ASM", "hazardType": "FLOOD", ... }
```

See `modules/alerts/webhook.routes.ts` and `webhook.processor.ts`. This path
returns `202 Accepted` immediately and processes asynchronously via BullMQ,
so a slow database write never holds their connection open, and transient
failures retry automatically with backoff.

## No integration point yet — needs a small module, not just a credential

| Module | Why it's different | What to build |
|---|---|---|
| **News** | RSS feeds generally don't set CORS headers, so even a configured feed can't be fetched directly from the browser or, in most cases, cleanly through the same generic adapter (RSS ≠ JSON). | A small scheduled job that fetches + parses RSS server-side (e.g. with `rss-parser`) and calls the same `upsertAlert`-style pipeline, or surfaces headlines through a dedicated `NewsItem` model if you don't want to force news into the `Alert` shape. |
| **River level *telemetry*** (continuous readings for a trend chart, as opposed to CWC's danger-mark-crossing *bulletins*, which the `cwc_river_levels` adapter above already handles as alerts) | This is numeric time-series data, not a discrete alert — doesn't fit the `Alert` model well. | Add a `RiverLevelReading` table (same shape as `WeatherSnapshot`) and a small polling job, once you have access to real CWC/India-WRIS gauge telemetry. |

## Checking integration status

```
GET /api/alerts/integrations/status
Authorization: Bearer <ANALYST or ADMIN token>
```

Returns `configured: true/false` per adapter — this is what the frontend
should use to show "not connected" instead of an empty list, so operators
and viewers can tell the difference between "no active hazards" and "we're
not actually watching this source yet."
