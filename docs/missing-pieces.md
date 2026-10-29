# DevNoder — current release and infrastructure boundaries

Canonical product: https://devnoder.srvel.net. Cloudflare Pages project `devnoder` builds `codex/repair-first-project`, explicitly approved by the owner as the production source. PR #3 remains draft against `develop`; neither `main` nor `develop` was merged. A push to this branch is a production release; verify its exact Pages deployment and GitHub checks before describing it as live.

## Product coherence and trust

DevNoder now uses one original node/code mark, self-hosted Srvel-aligned fonts, outline icons and visible “by Srvel” attribution without copying the locked parent logo or claiming shared parent accounts. The first useful journey opens an editable HTML/CSS/classic-JS starter; a blank project remains available. Code owns file browsing and direct file creation. Mobile uses a Files drawer, and the More menu has focus handling and English/French/Arabic labels.

Starter/templates no longer create a commit under a synthetic Srvel identity. Git commit identity is configured per project by the user; commit and pull are blocked until it is valid. Editable browser-local plan data cannot restore a paid entitlement; license activation and checkout refuse until server verification is configured. Community compute no longer pretends to contribute CPU cycles or earn credits. Unconfigured placeholders and registry installs are clearly disabled rather than presented as successful integrations.

## Model and project workflow evidence

The default small coding path uses a pinned Qwen 0.5B family and its actual compatible `onnx-community/Qwen2.5-Coder-0.5B-Instruct` q8 WASM fallback. The invalid old Xenova artifact path is gone. Progress uses real percentage units; the UI reports the runtime/artifact actually prepared, completed WASM output is not faked as streaming, and the ready state now clears the stale “Downloading” progress indication. In a fresh browser against a local Pages emulation of the production bundle, the trained Qwen model generated a JavaScript `add` function, and the result executed as `5` in a time-limited VM. That demonstrates one useful prompt/model/runtime task only—not a post-fix live deployment smoke, broad benchmark, physical-device GPU proof, offline guarantee or arbitrary-format support.

The supported public-model path accepts only Transformers.js-compatible ONNX text-generation repositories. WebLLM is limited to its pinned catalog. GGUF and arbitrary native formats are unsupported. Users may call a model already hosted on a trusted OpenAI-compatible endpoint; the app does not download remote-server weights. Browser storage quotas, cache eviction and offline behavior vary by device.

The browser acceptance suite covers blank/starter project creation, edit/save/reload, project preview, ZIP export, model registration, user-owned local commit identity, responsive navigation and truthful billing/compute states. GitHub credential UI/storage tests mock the GitHub API; no real credentialed remote write was exercised. Emulated Android is not physical hardware.

## Build, security and service boundaries

The clean install, TypeScript/Vite build, 162 unit tests (28 files) and 18 desktop/Android-profile Chromium scenarios pass. ESLint exits zero with 236 warnings; global line coverage is 29.25% and is not comprehensive platform coverage. The production-only dependency audit is clean. The full audit reports four low build-tool findings in the Workbox/PWA `deepmerge` chain and no moderate/high/critical advisories; npm's suggested resolution is a breaking downgrade, so it was not accepted. The PWA precaches 107 entries (~18.25 MiB), and no single emitted asset exceeds the 25 MiB Pages limit.

Cloudflare's executor remains not configured for general execution or deployment; it is not a native shell, package manager or framework server. Local JavaScript/Python/PHP file adapters, static project preview and source ZIP export have bounded scope. Billing, real hosted entitlements, collaboration transport, production registry APIs and OAuth still need their own server contracts, authorization, quotas, CORS and acceptance. Bot Fight Mode on the Srvel zone may challenge automation at the custom hostname; no zone-wide security downgrade was performed. The `pages.dev` alias is a separate origin with separate local data.

There is no connected DevNoder Supabase client/project. A separate LogoForge metadata/RLS finding must be reviewed with its owner and precise application scope; it was not changed from DevNoder. Do not alter unrelated parent DNS, locked brand policy or security controls as part of a frontend release.

See [the active acceptance backlog](../TODO.md), [the implementation plan](../plan.md), and the dated external readiness report for exact post-push deployment evidence. Do not call the entire platform ready because the tested frontend subset passes.
