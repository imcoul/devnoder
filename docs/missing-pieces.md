# DevNoder — current release and infrastructure boundaries

Canonical product: https://devnoder.srvel.net. Pages project `devnoder` builds `codex/repair-first-project`, the explicitly authorized production source. PR #3 remains draft to develop; main/develop are unmerged. Pushing this branch updates production. Public Source links open the deployed branch rather than stale main documentation.

## Product repair — 28 October 2026

The revised frontend has a coherent Srvel-endorsed identity, self-hosted fonts, meaningful public entry and Guide/About. Recommended HTML/CSS/classic-JS starter opens useful source immediately. Code owns Files; mobile uses a drawer to retain editing width. Workspace identity, browser-local storage and Backup are visible. More holds secondary tools. Settings opens the same accessible AI/model dialog; readiness precedes actions and technical limits are progressively disclosed.

A real CodeMirror lifecycle defect was repaired: opening an empty project's first buffer or resuming a starter now initializes the editor without requiring a panel remount. Unsupported templates and services state their requirements before selection. Remote preview/tunnels, paid billing, remote collaboration and nonexistent registry plugins are not offered as working actions.

## Models

The selected Qwen 0.5B family declares `onnx-community/Qwen2.5-Coder-0.5B-Instruct` q8 for its WASM fallback. The old Xenova repository was not a valid public artifact path. Chat input/output, percentage-based progress and pipeline disposal are corrected; completed WASM output is not animated as pretend streaming.

An isolated browser downloaded the real trained Qwen ONNX model and generated `function add(a, b) { return a + b; }`. Three isolated VM checks passed. A smaller trained instruction model downloaded but failed the useful-code prompt; download success alone is not model usefulness. These are not physical-device, broad-benchmark, all-WebGPU-model, arbitrary-GGUF or offline-persistence tests.

## Validation and quality

Clean lockfile install and TypeScript/Vite build pass. Unit suite: 24 files / 148 tests. Browser suite: 14 desktop/Android-profile Chromium scenarios including starter edit/preview/ZIP/reload, direct Code creation, More focus, consolidated Settings/AI handoff, model registration and mocked GitHub token persistence. Emulation is not real Android hardware.

All Pages assets are below 25 MiB; compressed oversized WASM retains scoped headers. Root, Guide, About, robots and sitemap are emitted. Lint has zero errors and 237 inherited warnings. Coverage is a measured ~25.95% statements baseline, not 80% platform coverage. Full audit has four low build-time deepmerge/workbox/PWA-chain findings and no moderate/high/critical findings; a compatible Hono adapter fix was applied. No patched same-major deepmerge release was published, so a breaking downgrade to old PWA tooling was not forced.

## Still external or unavailable

The executor's partial health response is not a general sandbox. Local JS/Python/PHP file adapters are not an OS shell, npm installation or framework dev server. Real OAuth app settings, executor/D1/R2 bindings, billing, hosted endpoints, registry backends and collaboration transport require their own security and runtime acceptance. Encrypted GitHub PAT storage is tested with mocked API validation, not actual remote writes.

Free zone-level Bot Fight Mode can challenge automated requests to the custom hostname. No zone-wide protection downgrade or parent DNS change was made. Normal-browser acceptance and curl challenges must be reported separately. The Pages alias is a different origin with separate local files. No DevNoder Supabase client/project exists in the connected account; another product's ownership policies cannot safely be guessed or repaired from this frontend.

Remaining acceptance is in [TODO.md](../TODO.md); design conventions are in [product-design.md](product-design.md). Do not mark the whole platform ready because frontend tests pass.
