# DevNoder — active delivery backlog

Status is evidence-based. Existing source code, a local build, a merged PR, a configured Worker, or a returned HTTP 200 does not alone satisfy a user-facing acceptance outcome. Main is the currently public release branch; develop and this repair branch are not production releases.

## P0 — Publish a real, correct DevNoder app

**Acceptance:** “Today I can go on the link and use it to make development, download whatever model I want and use it.” The canonical HTTPS link serves the current app (not “Hello world”); configured frontend and Worker origins resolve and are reachable; required core paths are actually deployed; CI runs checks and a supported publish step; every deployed asset fits the target host’s limits; failures are visible and never presented as success. “Whatever model” must be described as the formats/runtimes actually supported, with device limits shown.

**Current status:** blocked for release. Main still serves “Hello world”; no Pages project named `devnoder` exists. This branch uses Wrangler, loads Pyodide separately, centralizes Worker origins, and removes server-only SDK imports from the browser. The final build compresses ONNX WASM from 26.86 MB to 6.32 MiB, precaches it, sets gzip/WASM Pages headers, and has no asset over 25 MiB; local Wrangler verification passed. Five commits are pushed on `codex/repair-first-project`; draft PR #3 targets `develop`, and all four push/PR GitHub Actions checks pass. It remains unmerged, undeployed, and unverified at the canonical URL.

## P0 — Durable, safe project files and blank-project start

**Acceptance:** A user can create a blank project or choose/import a template/repository, create/rename/delete/open project-relative files through discoverable controls, edit in CodeMirror, save/save-all (including recovery from refresh/offline/project switch), and see the same latest content in buffers, project storage, Git status, preview and export after reopening. Opening a buffer does not falsely mark it dirty. AI Apply updates an already-open buffer atomically and reports errors. All file operations normalize paths and reject absolute paths/traversal outside the active project.

**Current status:** core flow passed in real desktop Chromium and Android-profile Chromium: create blank project → create a project file → edit → autosave → reload → reopen the saved file. Editor saves remain dirty on failure; close/project-switch flushes are guarded; AI Apply refreshes an open buffer; unsafe project-relative paths are rejected. Unit tests cover these contracts. Browser coverage does not yet verify Git status/commit, rename/delete, export, or a physical Android device.

## P0 — Functional development, run, preview and export/sync loop

**Acceptance:** From the hosted app, a user can run supported commands against the active project files using an explicitly identified local/WASM or isolated cloud runtime; commands read real files and dependencies are not simulated. Users see command output/errors and can cancel or recover. Project preview serves/builds the complete multi-file app and its assets. The user can export the complete source tree or use working authenticated remote setup/push/pull. Unsupported runtimes/features are gated and honestly explained.

**Current status:** partially implemented. `node`, `python` and `php` file commands execute real project files through their named WASM runtimes; the terminal now renders actual local command output, and `npm install` clearly reports that it installed nothing. Remote execution is disabled unless Worker health explicitly advertises execution; the live Worker is unconfigured and `/execute`/`/deploy` are 501. Preview remains an active-HTML blob, not a full project build; export/remote Git sync are incomplete. WASM file support is not a general shell, package manager, native toolchain or arbitrary framework runner.

## P0 — Correct, usable AI model selection and import

**Acceptance:** Each visible model is validated for the chosen adapter and runtime. Selecting a compatible hosted, WebLLM/MLC, Transformers/ONNX, GGUF companion/native, or remote endpoint model invokes that exact model, or the app clearly states which routes are supported and why others are not. Users can discover/add supported custom model identifiers/URLs using rendered UI with format validation; registrations and settings survive reload. Errors reset chat state and identify actionable causes; streaming preserves chunk boundaries; file actions are guarded and update the project source of truth.

**Current status:** partially repaired on this branch. Verified against locked WebLLM 0.2.84: Qwen Coder and Phi 3.5 IDs are registered. Wrong-model fallback was removed; unsupported models fail clearly. The AI panel configures one OpenAI-compatible endpoint with remote HTTPS enforcement, encrypted local key storage and exact model-ID routing. Chunk-safe SSE parsing now handles split frames/CRLF and has a passing regression test. No live provider/CORS inference test exists. Multiple endpoints, arbitrary native/GGUF loading and first-party model discovery/download remain incomplete.

## P0 — Transparent model download, cache, device and offline state

**Acceptance:** For local models, users can inspect runtime/format/size/device requirements, start and observe downloads, retry or cancel, confirm cache readiness, handle storage/load failures, and verify whether the model remains usable offline. Model weights are not implied to be part of PWA precache unless actually packaged. Hosted-only models clearly require network access and provider credentials.

**Current status:** blocked. Downloads are implicit library fetches; no app-level inventory, managed progress/retry/delete, offline preflight, or reliable selected-model readiness indicator exists.

## P0 — Secure/authenticated services and Git provider flow

**Acceptance:** Privileged execution/deployment routes require authorization, exact trusted origins, project isolation, quotas/timeouts/cancellation, and safe file/command boundaries. GitHub OAuth completes its callback/state/redirect handshake with properly scoped access; authenticated repository remote/push/pull behavior is explicit. Sensitive credentials are not exposed in logs or stored plaintext where avoidable. Security response headers and clear unavailable states are configured.

**Current status:** blocked by service-level setup/acceptance, not package audit. The final npm audit reports zero production and zero total dependency advisories. Worker origins are centralized; client execution requires health `configured: true` and explicit execute capability; the executor remains unconfigured and routes are 501. OAuth callback/scope/token handling, CORS allowlists, remote Git, execution isolation and rate limits remain unverified. Draft PR #3 is open with all four CI checks passing. CI deployment still needs a Pages project plus correctly scoped Cloudflare credentials.

## P1 — Complete approved Sprints 0–7 and cross-cutting plan

**Acceptance:** Continue the original `DEVELOPMENT_PLAN.md` and `DEEP_PLAN_OSS.md` scope after core P0 outcomes: tested service registry/VirtualFS and project context; functional terminal/multiplexer and MCP contracts; AI agent loops, model routing and RAG; conflict-safe sync, collaboration and deployable Durable Objects; mobile keyboard/touch/PWA install and accessibility; secure plugin/theme/snippet ecosystem; and privacy-respecting operational observability/feature controls. Preserve English/French/Arabic and RTL, no tracking by default, project compatibility and self-hosting aims. Complete feature-specific documentation, license review, and quality/performance gates. Dependencies and external credentials are documented; anything blocked by missing provider setup stays explicitly blocked.

**Current status:** partially implemented on branches but not release-verified. Develop has unused architecture and failing CI. Do not treat planned items as complete from source presence alone.

## Release gates

No production deployment, DNS/routing change, or external-code execution enablement until (a) all P0 acceptance outcomes are complete for the intended launch scope, (b) tests/build/security review and a read-only acceptance review pass, (c) required live provider endpoints/secrets are validated without exposing values, (d) the actual domain/build is verified, and (e) the owner explicitly approves that release. Continue in small, revertible branch commits. Update outcome status with evidence rather than percentages or aspirational dates.
