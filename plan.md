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
