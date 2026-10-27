# DevNoder — active delivery backlog

This is an evidence-based acceptance list, not a claim of full product readiness. The frontend is live at `https://devnoder.srvel.net` from Cloudflare Pages project `devnoder`, whose production branch is `codex/repair-first-project`. The public GitHub `main` branch is unchanged; draft PR #3 to `develop` is still open. A push to the Pages production branch may auto-deploy, so future branch changes affect the public site.

## P0 — Publish and operate the real DevNoder app

**Acceptance:** The canonical HTTPS link serves the current IDE; frontend assets and required service origins answer real contracts; CI and publishing work; assets fit the host; unsupported features fail visibly. Model support is described by actual runtime/format, including device limits.

**Current status: frontend live, platform contracts incomplete.** `https://devnoder.srvel.net` returns HTTP 200 and the DevNoder app. The Pages custom domain is active and the proxied CNAME points to `devnoder.pages.dev`. The production JavaScript loads successfully; the ONNX WASM is served with `Content-Type: application/wasm` and `Content-Encoding: gzip`. The latest full production-browser suite passed 8/8 on desktop Chromium and Android-profile Chromium. The deployment was explicitly made from the repair branch; it was not merged into `main` or `develop`. The executor Worker remains unconfigured, so this is not full-service readiness.

## P0 — Durable project files and blank-project start

**Acceptance:** Create or import projects, create/open/edit files through discoverable controls, save durably, recover on reload, and keep buffers, storage, Git, preview and export consistent. Project-relative file operations reject traversal.

**Current status: core path verified on the live domain.** The live browser tests passed blank-project creation → new file → edit → autosave → reload → reopen, on desktop and Android-profile Chromium. ZIP export was downloaded and checked for saved content and `.git` exclusion. Earlier regression tests cover failed saves, close/project-switch flushing, AI file refresh and unsafe paths. Rename/delete, Git commit conflict behavior and physical Android hardware remain unverified.

## P0 — Development, run, preview, export and sync loop

**Acceptance:** Run commands only through real, clearly named runtimes; show output/errors; preview the complete supported project scope; export all source/assets; configure and use authenticated remote sync; never imply unsupported packages or runtimes work.

**Current status: useful bounded workflow, not a full IDE shell.** Supported JavaScript/Python/PHP file commands execute through named local/WASM adapters; `npm install` honestly reports that it installed nothing. Live E2E verified sandboxed project-tree preview with linked CSS and ZIP export. The preview inlines local CSS, classic JavaScript and SVG into an isolated static HTML snapshot; CSP blocks external requests and limitations are surfaced for module graphs, binary preview assets and multi-page links. Framework builds, npm packages, native toolchains and a general shell are not supported.

The ZIP action flushes buffers, preserves binary bytes, excludes `.git` and caps export at 20,000 files/100 MiB. GitHub origin setup and encrypted per-device PAT storage are implemented; live E2E exercised token validation against a **mocked** GitHub API, not real credentials. Push/pull controls exist, but credentialed clone/push/pull and conflicts have not been tested against a real test repository. The executor Worker still returns 501 for `/execute` and `/deploy`.

## P0 — Correct model selection, download and inference

**Acceptance:** Each model uses its exact supported runtime or is rejected; users can discover/select/download compatible models, see progress and cache state, retry or clear files, and understand offline/device limits. Do not claim support for model formats the browser runtime cannot load.

**Current status: one real compatible model download/inference path works; broad model readiness remains unproven.** In an isolated browser against production, the app downloaded `onnx-community/tiny-random-gpt2-ONNX`, showed “Ready in this tab,” and generated text locally. This model is deliberately random and produced nonsense, so this validates download/runtime plumbing only—not useful code assistance or quality. The live UI also exposes the pinned WebLLM catalog and accepts public Hugging Face `owner/model` IDs for compatible Transformers.js ONNX text-generation repositories. GGUF and arbitrary native formats remain unsupported. Browser storage is quota/eviction-controlled, GPU/WebGPU and device-memory limits vary, cancellation is not reliable and offline persistence is best-effort. A custom OpenAI-compatible endpoint connects to a model already hosted on a user-selected server; it does not download weights. This does **not** meet a literal “download any model” requirement.

## P0 — Secure/authenticated services and Git provider flow

**Acceptance:** Git credentials are not saved plaintext; remote execution/deployment is authenticated and constrained; OAuth or explicit token flows work; origins, project isolation, quotas and timeouts are verified; unavailable routes stay disabled.

**Current status: storage UX implemented; service release still blocked.** GitHub PATs are validated and encrypted in a device-bound browser vault, with one-time legacy migration and disconnect. Encryption-at-rest does not protect against active same-origin scripts/XSS. OAuth callbacks/scopes remain unverified. The client requires explicit Worker health/configuration/capability before enabling cloud execution; the live executor is not configured and does not provide it. Collaboration, billing, templates and other APIs still need their own configuration and security acceptance. No real GitHub credential was used by the browser tests.

## Quality gates and release state

A clean `npm ci`, TypeScript/Vite build, 135 unit tests, full dependency audit and 8 desktop/Android-profile Chromium tests passed before the direct deployment. The production link was then smoke-tested: HTML/JS return 200, the domain is active, and gzip-WASM headers are correct. The 8 production-browser flows passed against `devnoder.srvel.net`, covering project persistence/export, preview, model UI/registration and mocked GitHub-token lifecycle; a separate isolated production-origin smoke downloaded and ran the tiny random ONNX model described above. Lint exits zero with 241 warnings; global line coverage is 23.49%, which is not broad evidence of whole-product correctness. All five PR check contexts (push/PR unit and E2E plus Cloudflare Pages) were green on commit `6a345c0`; check the current PR head before merge.

**Release state:** The frontend is publicly live from the dedicated repair branch by the user's direct instruction. PR #3 remains open/draft and unmerged. `main` was not changed. Future pushes to this branch can automatically update the public Pages deployment.

## Remaining work before “fully ready”

1. Test actual downloads and inference for representative small and larger compatible models; verify physical-device WebGPU, storage and offline behavior. Document the supported formats and keep GGUF outside scope unless a real runtime is added.
2. Configure/security-test the executor and collaboration backends or keep them clearly unavailable; validate authorization, CORS allowlists, project isolation, quotas, timeouts and cancellation before enabling remote execution.
3. Test real fine-grained GitHub token clone/push/pull, conflict behavior and permission failure on an authorized test repository. Test OAuth only if it will be offered.
4. Decide whether to merge PR #3 into `develop` and later `main`, since Cloudflare currently deploys the repair branch directly. Preserve a tested rollback path.
5. Add coverage and physical Android/device testing; address the 241 lint warnings. Keep the current 23.49% line coverage stated honestly.
6. Expand preview/runtime only with clearly specified and tested supported build targets; do not market the current static preview as an npm/framework build system.
