# Missing Pieces for DevNoder to Work as Intended

## 1. Cloudflare Infrastructure (not deployed)

The entire backend is hardcoded to `https://devnoder-executor.srvel-build.workers.dev` and `https://devnoder-collab.srvel-build.workers.dev` but these Workers don't exist yet.

| Resource | Purpose |
|---|---|
| `devnoder-executor` Worker | Cloud code execution (`/execute`), billing (`/billing/*`), compute pool (`/pool/*`), skills registry (`/skills`), templates registry (`/templates`) |
| `devnoder-collab` Worker (Durable Object) | Real-time collaboration via `y-websocket` |
| `devnoder-oauth` Worker | GitHub OAuth token exchange |
| D1 database | `database_id` is `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.toml` — tables not migrated |
| R2 bucket | `devnoder-storage` needs to be created |

## 2. Placeholder Credentials

| File | Placeholder |
|---|---|
| `src/services/cloud/CloudTier.ts` | `pk_live_REPLACE_WITH_STRIPE_KEY` |
| `src/services/git/GitHubAPI.ts` | `REPLACE_WITH_GITHUB_OAUTH_CLIENT_ID` |
| `wrangler.toml` | `REPLACE_WITH_D1_DATABASE_ID` |

## 3. PWA Icons Missing

`vite.config.ts` references `/icons/icon-192.png` and `/icons/icon-512.png` — these files don't exist in the repo. The PWA manifest will be broken and the app won't install properly.

## 4. `cloudExecutor.available` Hardcoded `false`

In `src/services/terminal/CloudExecutor.ts`, `available: false` is a static flag with no code path that ever sets it to `true`. It needs to be flipped once the Worker is deployed (e.g. via a health-check ping on startup).

## 5. License Validation is Mocked

`SubscriptionService.activateLicense()` does a client-side string check (`key.startsWith('PRO-')`). In production this must POST to the executor Worker → D1 for real validation, otherwise anyone can activate Pro by guessing the prefix.

## 6. Durable Object Not Wired

The collab WebSocket URL points to a Cloudflare Durable Object that needs to be deployed separately from the main executor Worker (`collab-server.worker.ts`).

## 7. D1 Schema Migrations Not Applied

`wrangler.toml` documents the `skills` and `templates` table DDL in comments but they've never been run against a real D1 instance.

---

> **TL;DR** — the frontend is complete; the project is blocked on deploying the Cloudflare backend (Workers + Durable Object + D1 + R2) and filling in the three placeholder credentials. Everything else (PWA icons, the `available` flag, mock license validation) are secondary but will cause visible breakage.
