# DevNoder repair and completion plan

## Goal

Bring the existing DevNoder PWA toward the approved `DEVELOPMENT_PLAN.md` and `DEEP_PLAN_OSS.md` without discarding existing work. The immediate outcome is an honestly published, mobile-first IDE where a user can create/import a project, make durable edits, select a compatible AI model, apply changes, run and preview the project, and export or sync it. “Any model” means every model supported by an explicitly documented runtime/format path—not a promise that every model can run on every device.

## Current checkpoint — 2026-10-27

The local `codex/repair-first-project` branch now passes a clean `npm ci`, production TypeScript/Vite build, 119 unit tests, two desktop/Android-profile Chromium acceptance tests, ESLint with zero errors, and `npm audit` with zero findings. The Pages output gzip-compresses and precaches the ONNX runtime (6.32 MiB); local Wrangler Pages emulation serves it with the expected gzip/WASM headers and byte-identical decoded content. Lint still reports 242 warnings and global line coverage is 22.01%.

This is not a release checkpoint: Cloudflare has no `devnoder` Pages project, the public domain still serves “Hello world,” the executor is unconfigured, and direct arbitrary model-weight download/management, full project build/preview/export and remote Git flows are still incomplete. Track remaining acceptance in `TODO.md`; do not announce the product as ready or change public routing until the owner-approved release gates pass.

## Implementation approach

Use `develop` (`37b3716`) as the integration baseline because it contains later planned work than the deployed `main`; preserve both branches and implement in `codex/repair-first-project`. Work in evidence-backed phases: (1) release/CI and config truthfulness, (2) durable/safe project-file lifecycle, (3) real project-aware execution/preview/export and usable Git sync, (4) correct provider/local model selection, import/download/error/offline management, (5) integration/security/mobile/accessibility/performance verification, (6) continue remaining approved plan items by priority. Keep unavailable integrations disabled or clearly labeled; do not report mock or source-only behavior as production-ready.

Set one project-root-contained filesystem as the application source of truth, then connect the editor, tabs, AI file changes, Git, terminal and preview to it. Keep path validation and transactional writes at the shared filesystem boundary. Treat each execution runtime as a capability-gated adapter with explicit isolation, limits and approval. Separate model metadata for WebLLM/MLC, Transformers/ONNX and remote OpenAI-compatible endpoints; only show a model as available when its loader/runtime path is validated. Provide durable download status and explain device/network/storage requirements.

Repair CI with supported Cloudflare tooling; choose a static/runtime hosting arrangement based on the current 25 MiB Pages per-asset constraint and the generated ICU asset. Configure production origins only from the confirmed account/deployment, then verify that frontend, OAuth, executor and optional collaboration URLs actually answer their contracts. Production rollout remains a separate, reversible release action and is not performed merely because the code branch passes.

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

Maintain `TODO.md` as the live acceptance backlog, preserving incomplete approved outcomes and recording only outcomes supported by tests or live evidence as complete. Work in small reviewable commits on the repair branch. Re-run affected checks after each phase and require an end-to-end create → edit → save → reload → model use → apply → run → preview → export/sync acceptance on the real published site before calling the product ready. Do not publish or change production routing until that explicit release gate is met and approved.
