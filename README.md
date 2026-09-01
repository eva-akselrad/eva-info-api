# eva-info-api

Status page and utility API for [evaakselrad.com](https://evaakselrad.com) services.

**Live:** [status.evaakselrad.com](https://status.evaakselrad.com)

## Tier 1 features

- **Status monitoring** — cron health checks every 3 minutes, auto-incidents (3 failures / 2 recoveries)
- **Public status page** — Vite + React SPA
- **API** — `/api/v1/status`, `/api/v1/incidents`, `/api/v1/registry`, `/api/v1/client`, `/api/v1/contact`
- **Atom feed** — `/feed.xml`

## Development

```bash
npm install
npm run dev:web          # Vite dev server (frontend only)
npm run dev              # Build web + wrangler dev
npm run db:migrate:local # Apply D1 migrations locally
```

## Deploy

```bash
wrangler d1 create eva-info-api-db   # first time — update database_id in wrangler.jsonc
npm run db:migrate
wrangler secret put ADMIN_API_KEY
wrangler secret put TURNSTILE_SECRET_PORTFOLIO
npm run deploy
```

## Secrets

| Secret | Purpose |
|--------|---------|
| `ADMIN_API_KEY` | Create/resolve incidents via API |
| `TURNSTILE_SECRET_PORTFOLIO` | Contact relay for portfolio (same as MyWebsite) |

## API examples

```bash
curl https://status.evaakselrad.com/api/v1/status/status
curl https://status.evaakselrad.com/api/v1/status/services
curl https://status.evaakselrad.com/api/v1/client
```

Create incident (admin):

```bash
curl -X POST https://status.evaakselrad.com/api/v1/incidents \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Planned maintenance","body":"Updating DNS."}'
```
