# What DevNoder Needs to Go Outworldly

Beyond just "working", here's everything needed to make DevNoder genuinely exceptional — grouped by impact.

---

## 🔴 Blockers (app doesn't fully work without these)

Already covered in [missing-pieces.md](./missing-pieces.md) — deploy the Cloudflare backend, fill placeholders, add PWA icons.

---

## 🚀 Product-Level Gaps

### 1. No onboarding flow
First-time users land on a blank code editor with no guidance. There's no welcome screen, no "create your first project" prompt, no tour. The app has 18 panels — users won't discover them.

**Needs:** a first-launch modal or guided tour that walks through: create project → open editor → try AI → deploy.

### 2. Plugin registry is entirely fake
`PluginAPI.ts` lists 4 plugins (`prettier`, `eslint`, `emmet`, `todo-tree`) pointing to `https://plugins.devnoder.srvel.io/...` — a domain that doesn't exist. Installing any plugin silently fails.

**Needs:** either real hosted plugin JS files, or at minimum inline WASM-based implementations for the core ones (Prettier especially).

### 3. Theme & skills registries are hardcoded mock data
`ThemeRegistry.ts` has 4 hardcoded themes. `SkillStore.ts` / `BuiltinSkills.ts` seed local data. The community aspect — browsing, publishing, downloading — never actually hits a real backend.

**Needs:** the D1-backed `/themes` and `/skills` Worker endpoints to be live.

### 4. Docs panel is online-only
`OfflineDocsService.ts` fetches from MDN/React.dev live. The "cache for offline" feature exists in code but the Cache API population is never triggered automatically.

**Needs:** a background sync that pre-caches docs on first load, not just on explicit user action.

### 5. No project management UI
There's a `ProjectRecord` schema in `db.ts` and a `projects` Dexie table, but zero UI to create, rename, switch, or delete projects. The editor just opens files into a single flat namespace.

**Needs:** a Projects panel or sidebar — the single biggest UX gap for a multi-file IDE.

### 6. Terminal file execution is a stub
`TerminalSession.runFile()` says *"File execution routes through WASM. Open file in editor first."* — it never actually reads from lightning-fs and runs the file.

**Needs:** wire `readFile()` from `GitService.ts` into `runFile()` and pass the content to `wasmRuntime.run()`.

### 7. `cd` command is missing
The terminal tracks `cwd` but there's no `cd` handler in `TerminalSession.run()`. It's the most-used shell command.

---

## 💡 Growth & Retention

### 8. No sharing / export story
Users can build something in the visual editor or write code, but there's no one-click "share this" flow. The QR code and tunnel features exist in `PreviewService.ts` but aren't surfaced prominently.

**Needs:** a persistent "Share" button in the preview panel that generates a QR + short link in one tap.

### 9. No push notifications
The SW push scaffolding exists in `App.tsx` but `reg.pushManager.getSubscription()` is never used to actually subscribe or receive notifications. There's no server-side push sender either.

**Needs:** a Cloudflare Worker endpoint that sends Web Push for collab invites, AI job completions, and deploy status.

### 10. AI message history is not persisted across sessions
`AIPanel.tsx` keeps chat in local React state — it's gone on refresh. `FeedbackStore.ts` saves rated messages but not the full conversation.

**Needs:** persist chat history to Dexie per project, restore on mount.

### 11. No keyboard shortcut for panel switching beyond the command palette
`PANELS` defines shortcuts `1–9` but there's no `keydown` listener wiring them up globally.

**Needs:** a global `keydown` handler in `App.tsx` (e.g. `Ctrl+1` → code, `Ctrl+2` → visual, etc.).

### 12. Collab room discovery is zero
Users must manually share a room ID string. There's no "active rooms" list, no invite link shown in the UI after joining, no QR code for the room.

**Needs:** surface `collabService.roomLink()` as a copyable link + QR immediately after joining.

---

## 🌍 Reach & Distribution

### 13. No landing page / marketing site
The app is a PWA at `/` with no public-facing homepage explaining what it is. There's nothing to link to, share, or rank in search.

**Needs:** a static landing page (can be a separate Cloudflare Pages project) with a demo GIF, feature list, and install CTA.

### 14. Only 3 languages (EN/FR/AR)
The i18n infrastructure is solid but the locale files are thin (~50 keys each). Major missing languages for the target mobile-dev audience: Spanish, Portuguese, Hindi, Chinese.

**Needs:** expand locale files and add at least ES + PT-BR.

### 15. No analytics / error tracking
There's zero visibility into what's breaking in production. No Sentry, no Cloudflare Analytics, no custom event tracking.

**Needs:** at minimum, Cloudflare Web Analytics (one script tag, privacy-safe, free) + a global `window.onerror` → Worker error log.

---

## 🏆 The One Thing That Would Make It Outworldly

**A working AI agent that can scaffold, edit, and deploy a full project end-to-end from a single prompt — entirely on-device for free users.**

The pieces are all there: `AIAgents.ts`, `BuiltinSkills.ts`, `TemplateService.ts`, `GitService.ts`, `PreviewService.ts`. Nobody has shipped a fully offline, zero-cost AI coding agent in a PWA. That's the moat. Everything else is polish.
