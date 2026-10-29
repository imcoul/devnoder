# DevNoder repair and completion plan

## Goal

Bring the existing DevNoder PWA toward the approved `DEVELOPMENT_PLAN.md` and `DEEP_PLAN_OSS.md` without discarding existing work. The immediate outcome is an honestly published, mobile-first IDE where a user can create/import a project, make durable edits, select a compatible AI model, apply changes, run and preview the project, and export or sync it. “Any model” means every model supported by an explicitly documented runtime/format path—not a promise that every model can run on every device.

## Current checkpoint — 2026-10-27

Cloudflare Pages project `devnoder` deploys the `codex/repair-first-project` branch; [the custom domain](https://devnoder.srvel.net) is active and returns HTTP 200. The public GitHub `main` branch was not changed. The feature remains open/draft in [PR #3](https://github.com/imcoul/devnoder/pull/3) against `develop`. The direct production deployment was explicitly approved; future pushes to `codex/repair-first-project` can auto-deploy.

A clean `npm ci`, production TypeScript/Vite build, 135 unit tests and eight desktop/Android-profile Chromium browser tests passed. The same eight browser flows then passed on the live canonical domain: project create/edit/autosave/ZIP/reload, model catalog/compatible-HF registration, project-tree preview and mocked GitHub PAT validation/persistence/disconnect. A separate isolated production-origin test downloaded `onnx-community/tiny-random-gpt2-ONNX` and ran local generation; its intentionally random weights produced nonsense, so this validates one small public ONNX download/runtime path only. No real GitHub credentials were used. The live JS loads; the gzip ONNX WASM is served as `application/wasm`. Build output stays under the Pages file-size cap, with 86 PWA precache entries. `npm audit` reports zero advisories. ESLint exits zero with 241 warnings; global line coverage is 23.49%.

The public frontend works for the tested subset, but this is not full product readiness. Meaningful coding-model downloads/inference on physical devices, arbitrary GGUF/format support, remote executor (`/execute` and `/deploy` remain 501), real credentialed Git push/pull, OAuth, and physical-device acceptance are unverified or unavailable. The app is a bounded static preview and local/WASM file runner, not a general package manager, native toolchain or framework build system. Track remaining acceptance in `TODO.md`. Treat the current Pages production branch as live; no unrelated branch or scope should be deployed without owner approval.

## Implementation approach

Use `develop` (`37b3716`) as the integration baseline because it contains later planned work than the deployed `main`; preserve both branches and implement in `codex/repair-first-project`. Work in evidence-backed phases: (1) release/CI and config truthfulness, (2) durable/safe project-file lifecycle, (3) real project-aware execution/preview/export and usable Git sync, (4) correct provider/local model selection, import/download/error/offline management, (5) integration/security/mobile/accessibility/performance verification, (6) continue remaining approved plan items by priority. Keep unavailable integrations disabled or clearly labeled; do not report mock or source-only behavior as production-ready.

Set one project-root-contained filesystem as the application source of truth, then connect the editor, tabs, AI file changes, Git, terminal and preview to it. Keep path validation and transactional writes at the shared filesystem boundary. Treat each execution runtime as a capability-gated adapter with explicit isolation, limits and approval. Separate model metadata for WebLLM/MLC, Transformers/ONNX and remote OpenAI-compatible endpoints; only show a model as available when its loader/runtime path is validated. Provide durable download status and explain device/network/storage requirements.

Repair CI with supported Cloudflare tooling; choose a static/runtime hosting arrangement based on Cloudflare Pages' 25 MiB per-asset constraint. The current production frontend is on Pages; its oversized ONNX WASM is compressed and header-verified. Configure origins only from the confirmed account/deployment, then verify that frontend, OAuth, executor and optional collaboration URLs actually answer their contracts. Keep a tested rollback path; production routing is now live by explicit approval and must not be widened or moved to another branch without approval.

## Project structure and responsibilities

- `src/components/`: accessible mobile-first onboarding, file/project controls, editor, AI, terminal, preview and Git interfaces.
- `src/services/fs/` and `src/services/storage/`: canonical project file abstraction, persistence, migrations and validated path operations.
- `src/services/editor/`: open buffers, dirty state, save/restore and editor synchronization.
- `src/services/ai/`: model/provider catalog, runtime adapters, downloading, chat streaming and guarded file actions.
- `src/services/terminal/` and `devnoder-executor/`: explicit local/cloud runtime contracts, project-scoped execution and limits.
- `src/services/preview/`: multi-file project build/serve/export, distinct from raw active-HTML preview.
- `src/services/git/` and `devnoder-oauth/`: local Git plus authenticated remote operations and complete callback handling.
- `devnoder-collab/`, `migrations/`, `docs/`: optional collaboration deployment, backend schema, architecture and operational instructions.
- `.github/workflows/`, `wrangler.toml`, deployment documentation: passing quality gates and reproducible, account-correct release configuration.

## Design continuity

Retain the accepted Srvel/DevNoder visual language and existing turquoise-led dark canvas, semantic design tokens, mobile-first layout, English/French/Arabic with RTL support, accessibility emphasis, and no-default-analytics decision documented in the existing project plans. Improve interaction clarity through persistent save state, explicit model/runtime state, and visible capability boundaries; do not silently relabel a prototype as a production feature.

## Delivery discipline

Maintain `TODO.md` as the live acceptance backlog, preserving incomplete approved outcomes and recording only outcomes supported by tests or live evidence as complete. Work in small reviewable commits on the repair branch. Re-run affected checks after each phase and require an end-to-end create → edit → save → reload → model use → apply → run → preview → export/sync acceptance on the real published site before calling the product fully ready. The current branch is explicitly deployed to production; treat every future push to it as a live release and preserve a tested rollback path.

## Product coherence pass — 28 October 2026

The owner approved fixing all material findings in `DevNoder-product-identity-diagnosis-2026-10-28.md`. Preserve the local-first project filesystem and already-deployed repair branch; changes to that branch are live releases. Do not migrate to Supabase, recreate the locked Srvel logo, change unrelated domains, merge PR #3 or silently call unsupported runtimes ready.

**First useful journey:** a recommended browser-runnable HTML/CSS/classic-JavaScript starter opens its actual first file. Editing, static preview and ZIP export form the clear primary loop. A deliberately blank project remains possible but the editor contains a direct new-file action and accessible file explorer. Creation/resume failures show recoverable status; no automatic embedding/model downloads occur at startup.

**Workspace structure:** Code, AI, Preview and Git are primary destinations; secondary tools remain reachable in a labeled More drawer/command palette rather than eight equal bottom tabs. A persistent project/brand header communicates active project, browser-local storage and access to projects/settings. Files are reachable in Code; Settings sections wrap or stack on narrow screens. One AI configuration destination handles models, providers and keys.

**Design movement:** Srvel's Quiet Craftsmanlike instrument/workbench identity. Principles: clear state before action, visible first result, restrained hierarchy, local-data honesty. Retain the deep-teal developer canvas and turquoise signature, reserve yellow for the recommended action, and use a legible lighter purple as a secondary dark-surface accent. Avoid decorative imagery, gradients, generic marketing-card grids and gratuitous animation. Instrument Sans defines product headlines/control hierarchy; Livvic supports explanatory text; JetBrains Mono remains the code face. Self-host fonts and use Phosphor Regular outline icons. A single original DevNoder node/code mark replaces the inconsistent DN/wave treatments; it is a product symbol, not a recreation of the locked Srvel company logo. DevNoder remains standalone with visible editorial 'by Srvel' endorsement; this is the authorized product implementation, not a silent portfolio-wide brand-policy change. Preserve theme/RTL/font-size/keyboard/reduced-motion accessibility.

**Voice and identity:** 'Build something useful, wherever you work.' and 'Your files stay in this browser. Export a backup before clearing storage.' Working canonical links use the real `imcoul/devnoder` source/issue destinations, `devnoder.srvel.net` product origin and local public guide. Explain parent-company relationship without claiming unverified shared Srvel accounts. Add meaningful initial HTML/metadata and a public guide explaining exact browser, model, runtime and data-recovery boundaries.

**Capability truthfulness:** template badges distinguish Runs here / Scaffold / Requires external environment; browser preview excludes arbitrary modules/frameworks. Unconfigured cloud execution/deployment/collaboration/billing are non-actionable with reasons, not 501 surprises. Replace 'fully offline', free-tier guarantees and physical-device-test implications with verified scope. Recommend a small compatible coding model, show decision-oriented preparation status, preserve explicit supported WebLLM/ONNX/server routes and never claim arbitrary GGUF/native formats. Try useful small-model generation in an isolated sandbox where practical; do not disguise model-quality/device constraints.

**Boundaries:** three shared code workstreams own non-overlapping files: workspace/onboarding/navigation/project lifecycle; identity/settings/public metadata/docs; AI/capability/template/optional-service surfaces. The parent owns dependencies, integration, Cloudflare access investigation, current Notion release checkpoint, validation and publishing. Supabase RLS warnings belong to LogoForge and require ownership/exposure review before any policy change; no blind cross-product database mutation. Cloudflare access changes must be narrowly scoped to public frontend requests, not weaken unrelated sites/API protections. External services, real Git credentials and physical Android hardware cannot be fabricated.

## Product-coherence integration checkpoint — 28 October 2026

Workspace, identity/public-entry and AI/capability workstreams were integrated. Parent browser acceptance found and repaired a real first-buffer CodeMirror initialization defect and early navigation-readiness test race. Code resumes the starter entry and offers a full-width mobile editor with Files drawer. AI setup is one keyboard-accessible dialog with progressive technical disclosure. Source links open the actual production branch.

Clean install/build, 148 unit tests and 14 desktop/Android-profile browser scenarios passed, including no startup weight request. Trained Qwen 0.5B ONNX q8 generated a JavaScript add function and passed three isolated VM checks. This is one useful code task, not a physical-device or broad benchmark. A smaller model's poor answer was not called useful. Quality debt remains: 237 lint warnings, ~25% statements coverage and four low unpatched build-time PWA-chain advisories.

Notion now reflects In Progress, live URL and draft PR #3; earlier PR #2/sprint notes are historical. Portfolio policies and parent DNS were preserved. Supabase metadata and free Bot Fight Mode were inspected without blind cross-product security mutations.

Publish the verified product changes to the already-approved live repair branch, wait for Pages/GitHub CI and run the live-domain suite. Record final evidence in the dated repair report instead of recursively pushing status-only hashes. Do not merge main/develop without instruction. Remaining platform and wider-security decisions stay in TODO.md.


## Product-coherence validation update — 29 October 2026

The first-use repair now leaves starter/template files uncommitted until a user supplies their own per-project Git identity. The initial user-facing Git form is stable across status refreshes. Editable local subscription values cannot restore paid tiers, billing/license calls fail closed, and the Community compute control cannot claim that work is being performed. More-menu items are labeled in English, French and Arabic, and remaining primary navigation/export controls use the shared outline icon set.

Latest local validation for this change set: clean production TypeScript/Vite build; 27 unit-test files / 156 tests; 18 desktop and Android-profile Chromium browser scenarios; ESLint exits zero with 235 warnings. Global line coverage is 29.57%. Production dependency audit reports zero; full audit contains four low build-tool-only Workbox/PWA/deepmerge findings with no moderate/high/critical items. No breaking PWA downgrade was applied. These results prove the tested subset, not physical mobile/WebGPU performance or all platform services.

A push to `codex/repair-first-project` is a production change, already explicitly authorized. After publishing this change set, verify the exact Cloudflare Pages deployment, GitHub CI and live URL; use the separate dated report for the immutable test/deployment evidence. Keep PR #3 open/draft and do not merge to `develop`/`main` unless the owner separately asks. The wider execution, collaboration, real Git-provider, billing, storage/offline, and LogoForge Supabase ownership gates remain open in `TODO.md`.


## Local-model ready-state correction — 29 October 2026

An actual isolated Qwen download/inference on the deployed Pages build exposed a misleading UI state: the model generated a correct JavaScript `add` function but continued to display “Downloading.” The root cause was readiness being evaluated after the retained progress event. Readiness is now derived from the active runtime first, progress is hidden/cleared when preparation ends, and a pure helper has six regression cases covering ready/download/cache/provider states.

Local validation on the resulting artifact: clean production build, 162 unit tests across 28 files, 18 desktop/Android-profile browser scenarios, and lint exit zero with 236 warnings. A fresh Qwen download on the corrected local production build generated `add(a,b)`, showed “Ready in this tab · Transformers.js / WASM,” and returned `5` when evaluated in a time-limited isolated VM. Coverage is 29.25% lines. This proves one bounded coding task, not broad model quality, physical-device performance, persistent offline cache, or the general platform.

The code and updated handover are ready to push to the already-approved production source branch. Treat it as a live release; confirm the exact Pages deployment and all five GitHub checks, then repeat the isolated model smoke against that deployment. Keep PR #3 draft and unmerged. The non-execution, billing, physical-device, credentialed Git, and security/ownership gates in `TODO.md` remain open.
