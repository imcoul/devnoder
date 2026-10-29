# DevNoder — active acceptance backlog

Live product: https://devnoder.srvel.net. Cloudflare Pages project `devnoder` builds `codex/repair-first-project`; draft PR #3 targets `develop`. Neither `main` nor `develop` was merged. A push to this branch updates production (the owner explicitly authorized this branch as production source); inspect Pages and GitHub checks after each push.

## Delivered product-coherence repair — 28–29 October 2026

- [x] One DevNoder node/code mark, visible Srvel endorsement, self-hosted Instrument Sans/Livvic/JetBrains Mono and Phosphor outline icons for primary controls. Public root/Guide/About, canonical/share metadata, sitemap, robots, and current README/CONTRIBUTING.
- [x] Recommended browser-runnable HTML/CSS/classic-JavaScript starter opens its first source. Starter and templates remain uncommitted until the user chooses an author and commits; no synthetic Srvel author or surprise initial commit.
- [x] Persistent project identity, browser-local state, Projects access and ZIP backup. Files in Code; full-width mobile editor with Files drawer; direct blank-project new-file action. First-buffer CodeMirror initialization and saved starter resume defects fixed.
- [x] Code / AI / Preview / Git / More hierarchy; secondary tools remain reachable; More keyboard/Escape focus restoration; complete localized English/French/Arabic menu labels; narrow-screen Settings. One accessible AI/model dialog.
- [x] Local/hosted readiness before send; manual downloads and progressive storage/compatibility disclosure. No automatic startup embedding/model download.
- [x] Official Qwen 0.5B ONNX q8 fallback replaces the invalid old Xenova path. Correct chat input/output, real percentage units, disposal, actual runtime/artifact reporting, non-simulated WASM output, and a fixed post-load state that now clears stale “Downloading” progress.
- [x] Isolated browser downloaded a trained Qwen coding model and generated an add function; three isolated VM checks passed. One useful task, not a broad benchmark or device/offline guarantee. A smaller model's poor output was not counted as useful.
- [x] Editable local subscription values cannot restore paid tiers; checkout and license activation refuse until a real server entitlement exists. Community compute no longer claims to donate CPU or earn credits; its action is not offered. Unsupported remote preview/tunnels, paid billing, remote sharing and nonexistent registry plugins are not advertised as working. Broken notebook/GGUF instructions removed.
- [x] Git author is explicit, project-scoped and user-controlled. Git commit/pull require a real configured identity. GitHub token tests remain mocked; no real credentialed remote write was used.
- [x] Notion main project records live link, draft PR #3 and historical/current roadmap distinction. Locked portfolio brand decisions were preserved.

## Verification checkpoint

Clean install and production TypeScript/Vite build pass. Unit suite: **28 files / 162 tests passed**. Browser suite: **18 desktop/Android-profile Chromium scenarios passed**, including starter edit/preview/ZIP/reload, direct Code creation, responsive navigation, model registration, user-owned commit identity, billing/compute unavailability, and mocked GitHub-token persistence. An isolated trained Qwen download on a local Pages emulation of the production bundle generated `add(a,b)` and its result passed in a time-limited VM; after the readiness fix the UI correctly reports **Ready in this tab · Transformers.js / WASM**. This is one useful task and browser emulation, not a physical Android device or broad benchmark. ESLint exits zero with **236 warnings**. Global line coverage is **29.25%** (statements 27.13%, branches 22.49%, functions 28.83%). Production dependency audit: **0 advisories**; full audit: **4 low build-tool-only findings** in the Workbox/PWA `deepmerge` chain, no moderate/high/critical findings. npm offers only a breaking downgrade for that chain; it was not forced. PWA build contains 107 precache entries (~18.25 MiB); emitted assets remain below Cloudflare's 25 MiB file limit.

The repaired model-readiness state passed the local production-build, full unit, lint and desktop/mobile browser gates. After each push, verify the exact Pages deployment, GitHub Actions and live browser flow before describing that commit as live, and record the exact commit in the dated product report. Keep PR #3 open/draft unless the owner separately requests a merge.

## Remaining acceptance — not marked complete

- [ ] Real WebGPU on physical desktop/mobile devices, larger model memory/performance and storage eviction; offline reload/persistence under real quota pressure.
- [ ] Real credentialed GitHub clone/push/pull/conflicts and hosted-provider CORS/API requests. Browser tests use mocked GitHub API and test-only tokens.
- [ ] General cloud/native execution, npm/framework dev servers, arbitrary GGUF/native runtimes, collaboration transport, real billing and registry backends. Static preview and local file adapters are not those services.
- [ ] Raise coverage; reduce inherited lint warnings; apply a tested upstream fix for the low build-time `deepmerge` advisory.
- [ ] Public access: free zone-wide Bot Fight Mode may challenge automated requests. No zone-wide security downgrade or unrelated Srvel protection change was made. Pages alias is a separate origin with separate browser-local files.
- [ ] Separate LogoForge Supabase access/ownership review with explicit application scope. No connected DevNoder Supabase client/project; unrelated private metadata was not mutated or disclosed.
- [ ] Srvel parent homepage and portfolio-wide brand-policy reconciliation. This pass does not change parent DNS or locked policies.
