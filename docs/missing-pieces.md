# DevNoder — current release gaps

**Snapshot:** 27 October 2026. This is a code/infrastructure readiness checklist, not a claim that the service is ready for users. The repair work is on branch `codex/repair-first-project`; the public `main` branch was not changed or deployed during this task.

## What exists in Cloudflare, and what is actually reachable

The authorized Cloudflare account has Worker scripts named `devnoder`, `devnoder-executor`, `devnoder-oauth`, and `devnoder-collab`, under the verified workers.dev subdomain `ibrahimmamadoucoulibaly`. The frontend’s wrong `srvel-build.workers.dev` origin was corrected on the repair branch. Worker existence does not mean that its product APIs work:

- The custom domain `devnoder.srvel.net` currently routes to a Worker that returns plain text **“Hello world”**, not the IDE. No Cloudflare Pages project named `devnoder` exists in the account.
- The executor health response reports it is not configured; `/skills` returns HTTP 501. The source returns HTTP 501 for `/execute` and `/deploy`. Billing, templates, skills, preview, and compute-pool paths require their own live acceptance checks; a valid hostname or HTTP 200 at `/health` is not enough.
- The collaboration script exists, but its checked health route returned 404 and a working Durable Object/Yjs session has not been proved.
- The OAuth script exists and has a correctly named account origin, but app callback handling, state/PKCE verification, key handling, redirect, and repository scopes still need an end-to-end test.
- `wrangler.toml` includes a D1 database ID and `devnoder-storage` R2 binding; existence, migrations, bindings, and data isolation still need deployment-time verification.

## Repair work now in the branch

The branch makes editor text durably autosave to the active project, flushes dirty files before close/project switch, keeps failed writes dirty, refreshes buffers after an AI-applied file replacement, and rejects unsafe project-relative paths. It adds a new-file flow and an explorer, makes `node`, `python`, and `php` file commands execute the project file through the corresponding WASM runtime, and no longer pretends a browser `npm install` created packages.

The large Pyodide module/data files are fetched lazily from the version-matched CDN. The production build gzip-compresses the 26.86 MB ONNX WASM asset to 6.32 MiB, sets `Content-Encoding: gzip` and `Content-Type: application/wasm` via Pages `_headers`, rewrites the runtime URL, and precaches the compressed runtime; no output file exceeds 25 MiB. Wrangler Pages local emulation returned HTTP 200 with those headers, and Node fetch/decompression recovered bytes identical to the source WASM. Pages supports custom static-asset headers and gzip-encoded WASM responses [1][2]; the host’s 25 MiB asset limit is documented at [3]. The installed WebLLM registry includes the listed Qwen Coder/Phi IDs; incorrect silent fallback was removed. One OpenAI-compatible endpoint can be configured and its exact model ID is routed; split-frame/CRLF SSE parsing has a unit regression. The PWA caches the runtime, not model weights. Direct arbitrary model-weight downloads, an app-managed model inventory/progress/cache lifecycle, live provider/CORS inference, multiple endpoints, and arbitrary GGUF/runtime support are not implemented.

The branch contains a Wrangler-based publish workflow, visible skip warning when the Pages project variable is absent, and a checked-in Playwright acceptance test. The final run passed two tests across desktop Chromium and Android-profile Chromium for blank-project creation, first-file creation, edit, autosave, reload, and reopen. TypeScript/Vite build passes; 18 unit-test files / 119 tests pass; `npm audit` reports zero vulnerabilities across production and development dependencies. `npm run lint` exits successfully with zero errors but reports 242 warnings; global line coverage is only 22.01%. GitHub rejected the branch push because the GitHub App lacks `workflows` permission for `.github/workflows/ci.yml`; no remote branch, PR, or Actions run was created. The branch does not equal a release.

## Still required for the user's “open a link and develop today” goal

1. **Finish quality gates:** verify the same checks in GitHub Actions after a reviewed branch push/PR. Extend tests to Git status/commit, preview, full-project export, failure recovery and physical Android Chrome. Raise the current 22.01% line-coverage baseline and reduce the 242 lint warnings.
2. **Publish the frontend:** create/configure the intended Pages project or static host, set the CI project variable and narrowly scoped Cloudflare credentials, deploy a reviewed release, and verify the canonical URL serves the app. Local Wrangler Pages emulation verified the compressed WASM headers/bytes; no deployable Pages project is configured, and no live CDN/custom-domain deployment has been made.
3. **Release the repair branch:** review the diff, merge to the actual release branch, run its CI, and verify the deployed immutable build. No merge, public deployment, domain/DNS change or production routing change has been made.
4. **Make the development loop real:** browser WASM is not a general laptop shell, and file-only PHP/Python/QuickJS support is not a full package manager, native toolchain or Node development environment. Do not say `npm install`, arbitrary shell commands, native packages or all frameworks work until implemented and tested. Implement a secure isolated executor or explicitly scope the initial release; connect multi-file build/preview and complete-source export.
5. **Finish model use truthfully:** first-party model discovery and direct arbitrary model download are not implemented. The UI supports the pinned built-in browser models and one OpenAI-compatible server endpoint; that endpoint uses weights served elsewhere. Verify live inference/CORS, model/runtime compatibility, managed progress/retry/cancel/delete, storage/cache/offline behavior, and device constraints. “Any model” is not supported today.
6. **Secure and verify services:** configure/authorize executor routes, enforce origin allowlists/project isolation/timeouts/quotas/cancellation, and verify OAuth and collaboration end-to-end. The final npm 12 audit reports zero production and zero total dependency advisories. Review service authorization, CORS allowlists, headers, token storage and licensing; do not enable privileged commands publicly before security acceptance.

## Retired claims from the previous handover

The old version of this file incorrectly said the Workers did not exist, the PWA icons were missing, and `cloudExecutor.available` could never become true. Cloudflare confirms the scripts exist; `public/icons/icon-192.png` and `icon-512.png` are present; and the client does perform an availability probe. These items were updated so future work does not repeat the obsolete claims.

### External platform references

[1] [Cloudflare Pages response headers](https://developers.cloudflare.com/pages/configuration/headers/) — `_headers` rules apply to static asset responses and may override response headers.

[2] [Cloudflare content compression](https://developers.cloudflare.com/speed/optimization/content/compression/) — Cloudflare documents `application/wasm` compression and preserving gzip `Content-Encoding` for supported clients.

[3] [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/) — the 25 MiB per-file deployment limit used for the build check.
