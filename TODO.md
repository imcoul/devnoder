# DevNoder — active delivery backlog

This is an evidence-based acceptance list, not a promise that the product is released. `main` remains the public release branch. Repair work stays on `codex/repair-first-project` and draft PR #3; source or local test success does not mean production is ready.

## P0 — Publish a real, correct DevNoder app

**Acceptance:** The canonical HTTPS link serves the current IDE; its frontend and required service origins answer their real contracts; CI checks and publish steps work; all assets fit the host; unsupported features fail visibly. Model support is described by actual runtime/format, including device limitations.

**Current status: blocked for release.** `https://devnoder.srvel.net` still serves “Hello world.” The Cloudflare account has no Pages project named `devnoder`. No new deployment, DNS/routing change, or production worker enablement has been performed. The repair branch now includes a Wrangler Pages deploy workflow and the compressed ONNX WASM output stays below Cloudflare’s per-file cap; its latest clean-install build passed locally. A live deploy/domain smoke test remains necessary.

## P0 — Durable project files and blank-project start

**Acceptance:** Create or import projects, create/open/edit files through discoverable controls, save durably, recover on reload, and keep buffers, storage, Git, preview and export consistent. Project-relative file operations reject traversal.

**Current status: core path verified.** Desktop Chromium and Android-profile Chromium tests pass blank-project creation → new file → edit → autosave → reload → reopen. Editor failures remain dirty and visible; project switches flush saves; unsafe paths are rejected; AI Apply refreshes an open buffer. Project ZIP export now flushes dirty buffers, preserves binary bytes, excludes `.git`, and is checked by a browser test. File rename/delete, Git commit behavior and physical Android hardware remain unverified.

## P0 — Development, run, preview, export and sync loop

**Acceptance:** Run commands only through real, clearly named runtimes; show output/errors; preview the complete supported project scope; export all source/assets; configure and use authenticated remote sync; never imply unsupported packages or runtimes work.

**Current status: improved but not a full IDE shell.** Supported JavaScript/Python/PHP file commands execute project files through their named local/WASM runtimes; `npm install` honestly reports that it installed nothing. The new preview reads the project tree and inlines local CSS, classic JavaScript and SVG into a sandboxed single-entry HTML preview. Its CSP blocks external requests and warnings identify missing/binary assets, local module graphs, and multi-page links it cannot render. Framework builds, ES-module dependency graphs, package installation, native toolchains and a general shell are not supported.

A “Download ZIP” action now exports the full project tree (including binary files but not `.git`) up to the documented in-browser cap of 20,000 files/100 MiB. GitHub origin configuration, encrypted per-device PAT storage, token validation, and explicit push/pull UI are implemented. Pull refuses an uncommitted worktree and refreshes open buffers. Browser tests verify remote configuration and encrypted token reload/disconnect using mocked GitHub API responses; real credentialed clone/push/pull is not yet live-verified. The configured executor Worker remains unconfigured and its `/execute` and `/deploy` routes return 501.

## P0 — Correct model selection and model downloads

**Acceptance:** Each listed model uses its exact supported runtime or is rejected; users can discover/select/download compatible models, see progress and cache state, retry or clear files, and understand offline/device limits. Model weights are not described as part of the PWA shell unless they actually are.

**Current status: local discovery and lifecycle controls now exist, but “any model” remains too broad.** The app exposes a searchable catalog from the installed WebLLM registry and lets the user add a public Hugging Face `owner/model` for Transformers.js only when it includes supported ONNX text-generation artifacts. GGUF and arbitrary model formats remain unsupported. Model load shows progress and selected-model cache/storage state and can clear supported cache files; browsers control quota/eviction, cancellation is not reliable, and offline persistence is best-effort. User-selected HF repositories are not verified until preparation is attempted. A custom OpenAI-compatible endpoint can route to the exact model hosted by the user's server; live provider/CORS inference has not been tested. The browser suite tests model registration/selection, not a full large-weight download/inference on physical devices.

## P0 — Secure/authenticated services and Git provider flow

**Acceptance:** Git credentials are not saved plaintext; remote execution/deployment is authenticated and constrained; OAuth or explicit token flows work; origins, project isolation, quotas and timeouts are verified; unavailable routes stay disabled.

**Current status: token and remote-sync path implemented; service release still blocked.** GitHub PATs are validated and encrypted in the device-bound vault, with legacy plaintext migration and an explicit disconnect action. This protects stored values at rest, not active same-origin scripts/XSS. OAuth callback/scopes remain unverified; users can connect with a fine-grained PAT instead. The executor, collaboration Worker, billing, templates and other live APIs still require their own service configuration and acceptance. Worker health correctly gates remote execution; the executor currently advertises no usable execution capability.

## Quality gates and release state

A clean `npm ci` succeeded. `npm run build` passed TypeScript and Vite; the PWA output includes 86 precache entries and no asset exceeds the 25 MiB Pages cap. Local Wrangler Pages emulation previously verified gzip/WASM headers and byte-identical decompression. After the clean install, 20 unit-test files/135 tests and eight desktop/Android-profile Chromium browser tests passed. `npm run lint` exits zero with 241 warnings. `npm audit` reports zero advisories across the full dependency tree. Global line coverage is 23.49%, so the suite is not broad proof of full feature correctness.

The two follow-up feature commits passed all four push/pull-request GitHub Actions checks. A status-document-only checkpoint accompanies draft PR #3 against `develop`; the PR remains open and draft, not merged. No Pages deployment or production routing change has been made.

**Release gate:** Do not deploy or change public routing until a reviewed scope is accepted, the real Pages project and narrowly scoped CI credentials are configured, required provider/Worker contracts are security-reviewed and live-tested, device/model/runtime limits are clear, and the owner separately approves the release. Continue the full backlog above or explicitly narrow the intended first-release scope.
