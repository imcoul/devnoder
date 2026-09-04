# DevNoder — Fix-Everything Roadmap: From "Frontend Complete" to "Ready for a First Project"

## Context

A code-level audit (2026-09-03) found DevNoder's own docs ("everything except manual infra tasks is implemented") were wrong on the most important point: **no user can create or open a project.** This plan grew through three rounds of pushback, each catching something a shallower pass missed:

1. **Round 1 correction — `devnoder-cli` portability.** I wrongly proposed dropping `isomorphic-git`. Confirmed: it's pure JS, needs no system git binary, and in Node uses plain `node:fs` + `isomorphic-git/http/node` (not `lightning-fs`, which is browser-only) — that's *why* it was a dependency in the first place. Keep it, wire it correctly.
2. **Round 1 — go deeper.** A second exploration pass covered areas skipped entirely the first time: the visual editor's honesty, community/plugin registries, credential storage security, accessibility, RTL, error handling, and the AI/MCP/RAG stack's real depth. Found real, previously-unflagged problems (Phase 5–6).
3. **Round 1 — LogoForge/Forgel.** Investigated `github.com/imcoul/LogoForge` directly: it already ships `mcp-server.ts`, a real MCP JSON-RPC server (stdio, over Firestore) exposing three brand-management tools. That's a concrete integration seam, not a hypothetical one.
4. **Round 2 — the bigger door.** The user wants DevNoder connectable to Srvel's *other* internal tools generally, specifically a planned-but-unbuilt "Srvel In" (Business Operating System / automation engine, n8n/Zapier-class but more capable). Checked Notion: "🖥️ Srvel In — Business Operating System" exists as a locked-architecture, zero-code vision doc (status: **OPEN**, module list undecided). Its own sketch of how the design app should connect to it is a **single static shared secret** (`doPost` + `API_SECRET`, adapted from an external reference implementation, never actually built for Srvel). That is not "bank grade," and it's the thing to actually fix — not by building Srvel In (it doesn't exist), but by building the secure connection framework on DevNoder's side now, so LogoForge, Srvel In, and anything else Srvel builds later plug into something real instead of a shared string.

This plan is now a **multi-session roadmap across three-plus repos** (`devnoder`, `devnoder-cli`, touch-points into `LogoForge`, and a forward-compatible contract for `Srvel In` once it exists). Priorities: **P0** = blocks a first project from working at all. **P1** = real, user-visible or security-relevant gaps. **P2** = strengthens the product but doesn't block first use.

A copy of this plan lives in the repo at `devnoder/docs/roadmap-fix-plan.md` and is mirrored/updated in Notion phase-by-phase, not just at the end.

---

## Status as of 2026-09-04 — handover for continuing elsewhere

**Phases 0–6 and 9 are done in `devnoder` on `claude/devnoder-wrangler-issues-kyhb0i` (PR #2), and Phase 8 is done in the separate `devnoder-cli` repo on `claude/devnoder-handover-docs-834g2y` (commit `07d51c1`, pushed, no PR opened yet) — all verified against real running instances, not just typechecked.** `devnoder` commits, in order: `68ba368` (Phase 0), `4e01f2a` (Phase 1), `ef93fbf` (Phase 2), `40fbd50` (Phase 3), `50a47fd` (Phase 4), `7a4a2a8` (skill fix), `2eb6256` (Phase 5), plus follow-up Phase 6 and Phase 9 commits. Phase 7 remains blocked (needs the project owner's Cloudflare secrets, and no source for its Workers exists in any repo in scope). Phase 10 depends on Phase 9's identity primitive getting a real counterparty to verify against. Phase 11 remains unstarted.

**Also diagnosed (not a code fix, no commit)**: the "Workers Builds: devnoder" GitHub check on PR #2 fails on every push, including on `main` — `wrangler.toml` has no `main` entry point or `[assets]` directory, and even adding `[assets] directory = "./dist"` hits Cloudflare Workers' hard 25 MiB per-asset limit against this build's ~29 MiB Pyodide `.dat` file. The app's real deploy path is `.github/workflows/ci.yml` → Cloudflare Pages (no such limit), which is green. This looks like a redundant/orphaned second Cloudflare Git integration pointed at the repo — recommended the project owner disable it in the Cloudflare dashboard rather than trying to make Workers Static Assets work for this build. Full diagnosis is on the PR as a comment.

**Phase 6 findings worth knowing about**: the original audit's "RTL not applied on load" was actually two bugs, not one — `$theme` and `$lang` (`src/stores/ui.ts`) were hardcoded atom defaults that ignored `localStorage`, so *both* the chosen theme and the chosen language (and therefore `dir`/RTL) silently reset to default on every single page reload, not just on first load. Fixed by restoring `$theme` from `localStorage` at store-init, and by centralizing language resolution in `src/i18n/index.ts` (detector reads/writes the same `devnoder-lang` key SettingsPanel already used, applies `document.dir`/`lang` at boot and on every `languageChanged` event). Verified end-to-end via the Playwright driver: switched to Arabic + High Contrast AAA, reloaded, confirmed `dir=rtl`, `lang=ar`, `data-theme=hc-aaa` all survived the reload (previously all three silently reset). Also added: proper tab semantics + labeled icon-only controls in `GitPanel.tsx` (previously zero `aria-*`), a labeled AI chat textarea + labeled agent pills in `AIPanel.tsx`, and DOM focus now actually moves to the panel container on panel switch in `App.tsx` (previously only an audio cue fired, keyboard focus never moved). The `~60% hardcoded left/right` claim from the original audit did **not** reproduce — a repo-wide grep found only one non-CodeMirror `left`/`right` in CSS (CodeMirror's own gutter border is correctly physical since code content is always LTR by convention, matching GitHub/VSCode) — so no sweep was needed there; the real, verified bugs were the persistence/dir-on-boot issue and the missing `aria-*` coverage.

**Three real bugs were caught during verification that weren't on the original punch list** — worth knowing about before continuing, since they were subtle enough to survive the original audit:

1. **`Buffer is not defined`** — isomorphic-git's index parser references Node's `Buffer` global, which Vite doesn't polyfill. Only threw on a genuinely fresh, zero-commit repo — the old single hardcoded `/devnoder` path had always already had a cached index by the time anyone looked, so this was invisible until real onboarding started creating brand-new repos. Fixed in `GitService.ts` (polyfills `globalThis.Buffer`).
2. **The active project was never actually persisted.** `GitService`'s active-project pointer is in-memory only; every page reload silently dropped users into a nonexistent `/projects/default` directory instead of their real project. Fixed with `ProjectService.resumeLastProject()`, persisted via `db.ts`'s settings table.
3. **The `run-devnoder` skill's own `click` command didn't reliably focus text inputs** (`el.click()` doesn't move keyboard focus the way a real pointer click does) — caught mid-verification when a typed API key silently landed on a stale nav button instead of the input. Fixed in the skill itself; see its Gotchas section.

**Remaining phases (6–11) are unstarted.** Phases 6, 8, 9, 10, 11 are self-contained code work. **Phase 7 needs the project owner's Cloudflare secrets** (GitHub OAuth client secret, etc.) before its Workers can actually be deployed — the code can be written without them, but `wrangler secret put`/`wrangler deploy` need to be run by someone holding real credentials. Phase 4's FlutterEditor question (drop vs. invest in real Dart parsing) and Phase 10's LogoForge Stage 2/3 (needs work filed on LogoForge's own roadmap) are flagged as open product decisions, not resolved here.

A PR from `claude/devnoder-wrangler-issues-kyhb0i` covering all of the above is open for review/merge — see the repo's pull requests.

---

## Phase 0 — Land the plan (P0) ✅ Done

Write this plan to `devnoder/docs/roadmap-fix-plan.md`, commit + push. Create/update a Notion tracking page linked from the 🔍 Code-Level Audit page, updated as each phase lands.

## Phase 1 — Project model & onboarding (P0, frontend, no secrets needed) ✅ Done, verified

- **`GitService.ts`**: replace `export const dir = '/devnoder'` with a dynamic accessor (`getDir()` reading a module-level `activeProjectId`, exposed reactively via a nanostore `$activeProjectId` for UI). Swap every in-body `dir` for `getDir()` across ~15 functions — mechanical, single-file diff, verified against the actual current source.
- **New `src/services/project/ProjectService.ts`**: `createProject`/`listProjects`/`openProject`/`importProject`, reviving the already-defined-but-dead `db.projects` Dexie table and the already-written-but-never-called `TemplateService.setFS()`/`applyTemplate()`.
- **`OnboardingPanel.tsx`**: one component, renders create/template/import when `db.projects.count() === 0`, renders a project switcher otherwise. Wired through the existing `PanelId`/`PANELS` registry — no router needed, this mechanism is already centralized.
- On project switch: `BufferManager.closeAllBuffers()` — bare paths like `src/App.tsx` are meaningless across projects.
- i18n: new `onboarding` key in all three locale files.

## Phase 2 — Stop the app from lying to itself (P0/P1, frontend) ✅ Done, verified

- **`ProjectHealthService.ts`**: replace fabricated fallback metrics with an honest `{unavailable: true}` state; call `setFS(fs)` at app init (same missing-wiring bug as `TemplateService`).
- **`CloudExecutor.ts`**: replace hardcoded `available: false` with a real `GET /health` check against the executor Worker (Phase 7), 3s timeout, re-checked lazily.
- **`SubscriptionService.activateLicense()`**: replace the client-side `key.startsWith('PRO-')` check (anyone can fake Pro) with `POST /billing/validate-license` on the executor Worker; keep the string check only as a fast-fail pre-check, never as ground truth.

## Phase 3 — PWA installability (P0, frontend) ✅ Done, verified

- Add `public/icons/icon-192.png` + `icon-512.png` (real assets, Srvel turquoise theme) — `public/` doesn't exist at all today.
- `index.html`: delete the hardcoded, 404ing `<link rel="manifest" href="/manifest.json">` — VitePWA's `generateSW` mode already injects the correct one.
- `src/sw.ts`: dead code (never referenced, `generateSW` mode replaces it) — delete rather than half-wire push notifications with no backend behind them.

## Phase 4 — Visual editing: fix the misleading part (P1) ✅ Done (honesty fix only — real-fix decision still open, see below)

`GrapesEditor.tsx` is real (bidirectionally synced to the buffer store, flows to `GitService` through the normal save path). **`FlutterEditor.tsx` is not** — a hardcoded `WIDGET_TEMPLATES` map generating Dart-*looking* text via string templates, no parser, no round-trip, one-way only, presented as a real editing mode.

- **Short term (cheap honesty fix)**: label it clearly as a starter/template generator, not a live Flutter editor.
- **Real fix (P2, separate scoped effort)**: either drop it or invest in genuine Dart-aware parsing — a real scope decision for the user, flagged not silently decided.

## Phase 5 — Security & reliability findings (P1) ✅ Done, verified

- **AI provider keys and MCP server tokens stored in plaintext** `localStorage`/IndexedDB. No encryption at rest. Fix: optional device-bound encryption via WebCrypto, honestly documented (raises the bar against casual disk/extension access, not a defense against same-origin XSS — nothing client-side can be).
- **No React error boundary anywhere** — a render-time throw white-screens the app. Add a top-level `ErrorBoundary` with a real fallback UI, local-only error logging (no telemetry).
- **`PreviewService.deploy()` sends only the single active buffer**, not a real build — fix to send the actual file tree/build output.
- **Community/Plugin/Theme registries are mock data presented as live** (`ThemeRegistry.ts` literally comments "Mock registry — in prod, fetch from Cloudflare Worker + D1"). Wire real `/plugins`/`/themes` endpoints (Phase 7) or label "Coming soon" instead of a fake catalog.

## Phase 6 — Accessibility & RTL (P1) ✅ Done, verified

- **RTL/theme not applied on load, fixed at the root cause**: `$theme`/`$lang` (`src/stores/ui.ts`) were hardcoded atom defaults that never read `localStorage`, so both silently reset on every reload, not just on first load. `src/i18n/index.ts` now resolves language once (stored `devnoder-lang` → browser locale → `en`) and applies `document.dir`/`lang` at boot and on every change; `$theme` now initializes from `localStorage` too.
- **`~60% hardcoded left/right`**: did not reproduce on a repo-wide grep — only one non-CodeMirror hit existed, and CodeMirror's own gutter border is correctly physical (code content stays LTR by convention, same as GitHub/VSCode). No sweep needed.
- **Accessibility gaps closed**: `GitPanel.tsx` tabs now use `role="tablist"`/`"tab"`/`aria-selected`, icon-only stage/unstage/AI-suggest buttons and text inputs are labeled; `AIPanel.tsx`'s chat textarea, model select, and agent pills are labeled; `App.tsx` now moves DOM focus to the panel container on panel switch (previously only an audio cue fired).
- Verified against a real running instance via the Playwright driver: switched to Arabic + High Contrast AAA, reloaded, confirmed `dir=rtl`/`lang=ar`/`data-theme=hc-aaa` all survived (previously reset to `ltr`/`en`/`default` every time).

## Phase 7 — `devnoder-executor`, `devnoder-oauth`, `devnoder-collab` Workers (P0/P1, backend) ⚪ Not started — needs your Cloudflare secrets

- `devnoder-executor`: `GET /health`, `GET/POST /skills`, `GET/POST /templates` real now (D1 tables already migrated); `/billing/*`, `/pool/*`, `/deploy`, `/execute` honest `501` for now. **Add**: `GET/POST /plugins`, `GET/POST /themes` (Phase 5), `POST /billing/validate-license` (Phase 2).
- `devnoder-collab`: code already complete — just needs `wrangler-collab.toml` + deploy.
- `devnoder-oauth`: new minimal Worker, `POST /token` for GitHub code→token exchange, holding `GITHUB_CLIENT_SECRET`.
- **Secrets**: I write the code + hand over exact `wrangler secret put <NAME>` commands; the user runs them locally (confirmed approach) — never typed into chat, never committed.
- **Deploy**: real `wrangler deploy` needs the user's real Cloudflare credentials — hand over exact commands, user runs them.

## Phase 8 — Fix `devnoder-cli` correctly this time (P1, separate repo) ✅ Done, verified

Committed to `devnoder-cli`'s `claude/devnoder-handover-docs-834g2y` branch (commit `07d51c1`), pushed, no PR opened yet (ask before opening one).

- **`init` no longer lies**: it previously did nothing but print "Project ready!" after a `sleep(800)` — no directory, no files, ever created. Now scaffolds a real, embedded React+Vite+TS starter (`src/templates/react-vite-ts.ts`) and refuses to touch a non-empty target directory instead of silently reporting success into it. Verified the generated project's `package.json`/`tsconfig.json`/`vite.config.ts` actually `npm install && npm run build` successfully — not just "files exist."
- **`--repo <url>` replaces the old fake path**: `git.clone({fs, http, dir, url, depth: 1})` via `isomorphic-git` + plain `node:fs` + `isomorphic-git/http/node` — confirmed working end-to-end against a real public GitHub repo. Dropped `@isomorphic-git/lightning-fs` (browser/IndexedDB-only, was never even imported, silently would have produced an empty working directory under Node had anyone tried to wire it).
- **Did not add** the `.tar.gz` fetch fast path or the `GET .../templates` executor integration from the original plan — both depend on Phase 7 infrastructure that isn't deployed anywhere reachable (confirmed: no source for `devnoder-executor` exists in any repo in scope, and the domain isn't confirmed live). Building against an unconfirmed live contract would risk the same "presented as done, isn't really" problem this whole roadmap exists to fix. Left as a documented follow-up once Phase 7 actually ships.
- **`deploy`**: now really `execSync`s `wrangler pages deploy` instead of just printing the command; confirmed it now surfaces wrangler's own real `CLOUDFLARE_API_TOKEN` error instead of a fake success message.
- **Found and fixed a bug not on the original list**: `doctor`'s `npm available`/`package.json` checks called `require()` inside a package that's `"type": "module"` and compiles to real ESM — `require` isn't defined there, so every run silently threw and was swallowed by the surrounding `try/catch`, making both checks always report `✗` regardless of the real state. Reproduced (`node dist/index.js doctor` reported both as missing in this exact repo, which has both) and confirmed fixed.
- Also added the `.gitignore` this repo never had (`node_modules/`, `dist/`) and stopped `build`/`deploy` from crashing with a raw Node stack trace when the underlying command fails.

## Phase 9 — Secure Integrations Framework: "the door" (P1, new scope — this is the actual ask) ✅ Done (framework + consent + audit + identity primitive — live signing verification is Phase 10's job), verified

DevNoder needs a real door for connecting to Srvel's other tools — LogoForge today, "Srvel In" (an automation/BOS engine, n8n/Zapier-class, not yet built — confirmed via Notion: status OPEN, zero code) whenever it exists, and anything else Srvel builds later. The only connection pattern currently sketched anywhere in Srvel's docs (for the design app → future BOS link) is a single static shared secret with no scoping, no revocation, no audit trail — the opposite of "bank grade." Building Srvel In itself is out of scope (it doesn't exist yet); building the framework it and LogoForge will plug into is squarely in scope, and doing it now means neither of those projects has to retrofit a weaker pattern later.

Generalize what DevNoder already has — the MCP client (`MCPClient.ts`, real WS/HTTP+SSE JSON-RPC, already tool-calling capable) and `MCPConfigStore.ts` (currently a flat list of server presets) — into a proper connections framework:

- **Scoped capability tokens, not blanket secrets.** Every connection (to LogoForge, to a future Srvel In, to anything) gets a token scoped to specific declared capabilities (e.g. "read project files," "trigger a deploy," "read health metrics") — never an all-or-nothing shared key like the `API_SECRET` pattern Srvel's own docs currently sketch.
- **Mutual verification, not one-way trust.** Each side should be able to verify the other's identity — asymmetric signing per connection (the connecting tool signs its requests; DevNoder verifies against a registered public key) is a meaningfully stronger baseline than a shared static string, and is what should replace the `doPost`/`API_SECRET` sketch project-wide, not just for this one link.
- **Consent UI.** First connection attempt shows the user exactly what capabilities are being requested, before granting anything — mirrors an OAuth consent screen. A visible, per-connection **revoke** control afterward (a kill switch), since automation platforms misfiring in loops is n8n/Zapier's own most common failure mode.
- **Local, append-only audit log** of every action taken through a connection — critical once things happen without a human directly triggering each one, and consistent with the project's zero-telemetry-by-default stance (the log stays local, nothing phones home).
- **Encrypted-at-rest storage** for connection credentials — builds directly on Phase 5's WebCrypto work rather than being a separate mechanism.
- This becomes the actual `MCPConfigStore.ts`/`MCPClient.ts` rework; "Notion"/"GitHub" presets and a future "Forgel Brand Tools"/"Srvel In" preset are all just entries in the same framework, not special-cased integrations.

**What actually landed, and what's honestly still open:**

- **Capabilities are a real enforced gate, not a label.** `MCPServerConfig.capabilities: MCPCapability[]` (`read`/`write`/`execute`/`network`) is required on every connection; `MCPClient.connect()` and `callTool()` both refuse a connection with zero granted capabilities. Verified live: called `connect()` on a zero-capability config directly and confirmed it throws (`"no capabilities granted — nothing to connect for"`) rather than just looking restricted in the UI.
- **Consent UI ships and actually blocks.** Adding a server (preset or custom) now opens a modal listing the requested capabilities before anything is saved or enabled — presets pre-check sensible defaults (e.g. Filesystem: read+write; Custom WebSocket: none, forcing an explicit choice), the user can narrow or broaden before granting, and "Grant & add" is disabled with a visible warning at zero capabilities. Verified live end-to-end: unchecked all boxes and confirmed the button disabled + warning appeared, then granted only "Read" on the Filesystem preset and confirmed the saved server shows only a `Read` badge, not the preset's full default set.
- **Revoke is real, not just disable.** The existing per-server ✕ (relabeled "Revoke" with an accessible description) already deleted the Dexie row — including its Phase-5-encrypted headers — so it already met "kill switch, not pause"; it now also revokes the connection's signing identity (below) in the same action. The enable/disable toggle remains the pause control, unchanged.
- **Local append-only audit log**, a new "Audit log" tab: every `callTool` call is recorded (allowed/denied/error) with the server name denormalized so history survives a revoke, and only argument *names* are logged, never values — this log isn't a secrets store. Verified live: triggered a denied call against a non-connected server and confirmed it appeared correctly labeled with its arg keys and the denial reason.
- **Connection identity — the asymmetric-signing primitive, honestly scoped.** `ConnectionSigning.ts` generates a real ECDSA P-256 keypair per connection (private key re-imported non-extractable before being persisted, mirroring Phase 5's `CryptoVault` device-key pattern), exposed via a "Generate identity" control that shows the public key to hand to a counterparty. Verified the crypto itself is correct — sign then verify round-trips true, a tampered payload correctly fails verification — but **it is not wired into any live outgoing request** to Notion/GitHub/the generic presets, because no real counterparty implements this scheme yet (this repo has no signature-aware external server to test the actual handshake against). Building against an unconfirmed protocol on the receiving end would be exactly the kind of "presented as done, isn't really" problem this whole roadmap exists to fix — so this is deliberately left as forward-compatible groundwork, wired into a live request only once Phase 10 has a real counterparty to verify it.
- **Encrypted-at-rest**: no new mechanism needed — Phase 5's `CryptoVault` already covers server headers/tokens, and the only new secret-shaped value here (the signing private key) uses the stronger non-extractable-CryptoKey pattern instead.

## Phase 10 — DevNoder ↔ LogoForge/Forgel integration (P1/P2, cross-repo, built on Phase 9) ⚪ Not started

LogoForge already exposes `mcp-server.ts` (stdio, `list-active-brands`/`get-brand-guide`/`update-brand-logo`, Firestore-backed — one of LogoForge's own three still-undecided DB choices, not something to hard-couple to). DevNoder's MCP client supports WS/HTTP+SSE standalone (stdio needs an external Termux bridge, wrong fit here).

- **Stage 1** (DevNoder-side only): add a "Forgel/LogoForge Brand Tools" preset into the Phase 9 framework — ships independently, works the moment Stage 2 is live.
- **Stage 2** (needs LogoForge-side work — file as a new item in *their* Notion roadmap, not built unilaterally here): add an HTTP+SSE MCP transport to LogoForge's existing Express `server.ts`, reusing `mcp-server.ts`'s tool logic and authenticating via Phase 9's scoped-token pattern instead of a shared secret.
- **Stage 3** (LogoForge-side scope expansion, explicitly flagged): current tools only touch an existing brand's logo SVG — no generation (`generate-logo-concept`) or export (`export-brand-assets`) tools yet, which is what "handle expert design parts DevNoder can't" actually requires. Real product work on a separately-phased product with its own quality gates — propose it to LogoForge's own Roadmap & Progress Log.

## Phase 11 — Tests, CI, and honest docs (P1/P2) ⚪ Not started

- **Zero test coverage exists today** in either `devnoder` or `devnoder-cli`. Add `vitest` unit tests for `GitService.ts`/`ProjectService.ts` and the executor Worker's real routes plus the `501` contract for stubbed ones.
- **No CI workflow** runs tests/build on PRs in either repo. Add a minimal GitHub Actions workflow (`typecheck` → `lint` → `test` → `build`).
- **Keep docs honest going forward** — this entire plan exists because docs said "frontend complete" when it wasn't. Update docs from verified state once phases land, not from memory of intent.

---

## Verification (after Phases 1–3 land)

Use the already-committed `.claude/skills/run-devnoder/` Playwright driver:
1. `npm run build` stays green throughout — clean today, don't regress it.
2. Clear IndexedDB for a clean first-run state, confirm the onboarding panel appears automatically, screenshot it.
3. Drive "create blank project" through the real UI, confirm it lands on Code panel with a real repo initialized, screenshot it.
4. After Phase 7 deploys (user-run): `workers_list` via the Cloudflare MCP connector shows all three Workers; live `GET /health` confirms the executor Worker responds; re-run onboarding with "start from template."
5. After Phase 9: confirm the consent UI and revoke control work end-to-end with a test connection before wiring any real external tool to it.

## Critical files

- **Project model**: `src/services/git/GitService.ts`, `src/services/storage/db.ts`, `src/services/templates/TemplateService.ts`, `src/stores/ui.ts`, `src/components/panels/index.tsx`
- **Honesty/security fixes**: `src/services/health/ProjectHealthService.ts`, `src/services/terminal/CloudExecutor.ts`, `src/services/revenue/SubscriptionService.ts`, `src/services/community/PluginRegistry.ts`, `src/services/community/ThemeRegistry.ts`, `src/services/preview/PreviewService.ts`
- **Editor honesty**: `src/components/visual/FlutterEditor.tsx`
- **Accessibility/RTL**: `index.html`, `src/i18n/index.ts`, `src/components/ai/AIPanel.tsx`, `src/components/panels/*`, `src/components/git/*`
- **PWA**: `index.html`, `src/sw.ts`, `vite.config.ts`
- **Backend**: `wrangler.toml`, `migrations/000{1,2}_*.sql`, `src/services/collab/collab-server.worker.ts`, `src/services/git/GitHubAPI.ts`
- **Integrations framework**: `src/services/ai/MCPClient.ts`, `src/services/ai/MCPConfigStore.ts` (Phase 9 — this is the door)
- **CLI (separate repo)**: `devnoder-cli/src/index.ts`, `devnoder-cli/package.json`
- **LogoForge (separate repo, coordinate via their own Notion roadmap for Stage 2/3)**: `imcoul/LogoForge`'s `mcp-server.ts`, `server.ts`
- **Srvel In (does not exist yet — Phase 9's framework is the forward contract for it)**: no files, tracked via Notion "🖥️ Srvel In — Business Operating System"
