# DevNoder — current release gaps

**Snapshot:** 27 October 2026. This is an evidence-based readiness note, not a claim that the service is ready for users. The feature code at `1a73910` is on `codex/repair-first-project` and draft PR #3 to `develop`; subsequent work is a status-document-only update. The public `main` branch and production routing were not changed or deployed.

## What exists in Cloudflare, and what is actually reachable

The authorized Cloudflare account has Worker scripts named `devnoder`, `devnoder-executor`, `devnoder-oauth`, and `devnoder-collab`, under the verified `ibrahimmamadoucoulibaly.workers.dev` subdomain. Worker existence does not mean that the product APIs work.

- The custom domain [devnoder.srvel.net](https://devnoder.srvel.net) currently serves plain text **“Hello world”**, not the IDE. No Cloudflare Pages project named `devnoder` exists in the account.
- The executor reports it is not configured; `/skills`, `/execute`, and `/deploy` return HTTP 501. A valid hostname or HTTP 200 at `/health` is not evidence that remote execution works.
- The collaboration script exists, but its checked health route returned 404; a working Durable Object/Yjs session has not been proved.
- The OAuth script exists, but its callback/state/scopes are not verified. The app now offers an explicit GitHub PAT flow; OAuth is not required for that path.
- `wrangler.toml` includes a D1 ID and `devnoder-storage` R2 binding; existence, migrations, deployment bindings, authorization and data isolation still need deployment-time verification.

## Repair work in the branch

The branch makes editor text durably autosave to the active project, flushes dirty files before close/project switch, keeps failed writes dirty, refreshes open buffers after AI file replacement, rejects unsafe project-relative paths and includes new-file creation. It executes supported file commands through named local/WASM runtimes and no longer pretends browser `npm install` created packages.

### Models

The AI panel has a searchable catalog sourced from the installed WebLLM prebuilt registry, explicit local-model preparation/progress/cache controls, browser storage estimates and supported cache deletion. It also supports adding a public Hugging Face `owner/model` for Transformers.js only when compatible ONNX text-generation artifacts are available. That is not support for arbitrary model formats: GGUF remains unsupported, and users must attempt preparation to discover whether a given HF repository fits the runtime. Model downloads depend on browser storage, network, GPU/WebGPU, device memory and provider configuration; cancellation and offline persistence cannot be guaranteed. An OpenAI-compatible endpoint routes the exact configured model ID to a server the user controls. Full download/inference of a large model on physical devices and live external provider/CORS behavior remain unverified.

### Run, preview, export and Git

JavaScript/Python/PHP file commands run only through their supported local/WASM adapters; this is not a general OS shell, native toolchain or npm environment. The project preview builds an isolated static snapshot from the project tree: local CSS, classic JavaScript and SVG references are inlined under a restrictive iframe CSP; external requests are blocked and unsupported ES-module graphs, binary preview assets and multi-page links are reported rather than claimed to work. Project ZIP export flushes buffers, preserves binary bytes, excludes `.git`, and is capped at 20,000 files/100 MiB to protect mobile memory.

GitHub origin setup plus explicit push/pull controls are present. PATs are validated and stored encrypted in the device-bound CryptoVault, with legacy plaintext-key migration and a disconnect action. Pull refuses a dirty worktree and refreshes open buffers. Active same-origin scripts can still access an in-memory token, so encryption-at-rest is not protection from XSS. Browser acceptance tests exercise remote setup plus mocked token validation, encrypted persistence across reload, and disconnect; **a real credentialed clone/push/pull against GitHub has not been exercised**. Fine-grained token permissions are needed for each repository operation.

### Build and tests

The build gzip-compresses the 26.86 MB ONNX WASM asset to 6.32 MiB, rewrites its runtime URL, uses Pages `_headers` for gzip/WASM response headers, and precaches the compressed file. After a clean `npm ci`, `npm run build` passed TypeScript/Vite and generated 86 PWA precache entries (17,614.55 KiB); no individual output file exceeds 25 MiB. Local Wrangler Pages emulation previously returned HTTP 200 with the expected headers; decompressed bytes matched the installed source WASM. Cloudflare's documentation covers the [Pages per-file cap][3], [static asset response headers][1] and [gzip content encoding][2]. Emulator results do not prove a deployed domain works.

`npm test -- --run --coverage` passed **20 files / 135 tests**, with **23.49% global line coverage**. `npm run test:e2e` passed **eight tests** across desktop Chromium and Android-profile Chromium for first-project persistence, model registration, project-tree preview, ZIP contents and mocked encrypted-token lifecycle. Android is emulated, not a physical device. `npm run lint` exits zero with **241 warnings**. The full `npm audit` reports **zero advisories**. GitHub Actions on the current PR head passed all four push/pull-request test and E2E jobs.

## Still required before “open a link and develop today”

1. **Review and merge the repair PR:** [draft PR #3](https://github.com/imcoul/devnoder/pull/3) is open against `develop`, all four CI checks passed, and it remains deliberately unmerged. The review must separately evaluate code and remaining acceptance limits.
2. **Publish the frontend:** create/configure the intended Pages project or another host, set the Pages project and narrowly scoped CI credentials, deploy a reviewed release, then verify the canonical HTTPS URL. Local Wrangler emulation is not a production deployment.
3. **Bring up and secure backend services:** configure and validate executor/OAuth/collaboration routes and bindings. Before public execution, enforce origin allowlists, project isolation, authentication, quotas, timeouts and cancellation. Keep unsupported routes disabled.
4. **Finish live model/runtime verification:** download and run representative compatible models on real target devices; verify live inference/CORS and device storage/GPU constraints; state clearly that arbitrary GGUF and every conceivable model format are not supported.
5. **Exercise real remote Git and provider flows:** test scoped fine-grained token clone/pull/push against authorized test repositories; test OAuth only if it is to be offered; verify live OpenAI-compatible CORS/provider streaming without exposing secrets.
6. **Improve assurance:** raise 23.49% line coverage, reduce 241 lint warnings, test conflicts/failure recovery, and run physical Android testing. Preview intentionally does not replace a framework/package build; scope first-release support explicitly.
7. **Approve release separately:** no merge, public deployment, DNS/domain change or production route change has occurred in this task.

### External platform references

[1] [Cloudflare Pages response headers](https://developers.cloudflare.com/pages/configuration/headers/) — `_headers` rules apply to static asset responses and may set response headers.

[2] [Cloudflare content compression](https://developers.cloudflare.com/speed/optimization/content/compression/) — supported gzip encoding and WebAssembly content types.

[3] [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/) — the per-file deployment cap used in the build check.
