# DevNoder Development Plan

**Status**: Draft | **Version**: 1.0 | **Last Updated**: 2026-09-21

---

## Executive Summary

DevNoder is a mobile-first offline IDE with AI, MCP, Git, and terminal capabilities. The codebase has strong foundations but suffers from architectural fragmentation, incomplete implementations, and missing production hardening. This plan addresses root causes systematically.

**Goal**: Transform from "impressive prototype" to "production-grade IDE" in 10 weeks.

---

## Phase 0: Foundation (Weeks 1-2) — Unblock Everything

### 0.1 Fix Production Build
- **Problem**: `@php-wasm/web-8-5` missing WASM file breaks `vite build`
- **Solution**: Pin to working version or dynamic CDN import
- **Files**: `package.json`, `vite.config.ts`
- **Acceptance**: `npm run build` succeeds, dev server unchanged

### 0.2 Service Registry (Dependency Injection)
- **Problem**: 25+ global singletons, impossible to test, circular imports
- **Solution**: Central registry with explicit registration
- **Files**: 
  - `src/services/registry.ts` (new)
  - Migrate: `cryptoVault`, `mcpConfigStore`, `aiGateway`, `gitHubAPI`, `terminalSession`, `cloudExecutor`, `embeddingEngine`, `templateService`, `projectService`, `bufferManager`, `codeSyncEngine`, `syncQueue`, `audioCueService`, `themeRegistry`, `computePool`, `finetuneExport`, `collabService`, `snippetService`, `secretDetector`, `projectHealthService`, `subscriptionService`, `pluginRegistry`, `pluginAPI`, `offlineDocsService`, `commitMessageAI`
- **Acceptance**: All services retrievable via `registry.get('key')`, `registry.reset()` works in tests

### 0.3 Unified ProjectContext
- **Problem**: Project state scattered across GitService, BufferManager, ProjectService, TerminalSession
- **Solution**: Single source of truth atom
- **Files**: `src/stores/projectContext.ts` (new), update all consumers
- **Acceptance**: Project switch updates all dependent services atomically

### 0.4 VirtualFS Abstraction
- **Problem**: Two sources of truth (IndexedDB buffers + lightning-fs Git working tree)
- **Solution**: Single virtual filesystem layer
- **Files**: `src/services/fs/VirtualFS.ts` (new), replace `fs` imports in GitService, TemplateService
- **Acceptance**: File reads/writes consistent across editor, git, templates, sync

### 0.5 Test Infrastructure
- **Problem**: 3 test files, no CI gate
- **Solution**: Vitest + Playwright + coverage thresholds
- **Files**: `vitest.config.ts` (enhance), `.github/workflows/test.yml` (new), 5 service tests
- **Acceptance**: `npm test` passes in CI, >80% service coverage

---

## Phase 1: Terminal 2.0 (Weeks 2-4) — Real PTY

### 1.1 Durable Object Executor
- **Problem**: HTTP-based cloud executor, no interactive PTY
- **Solution**: Cloudflare Durable Object with WebSocket upgrade
- **Files**: 
  - `devnoder-executor/src/TerminalDO.ts` (new)
  - `devnoder-executor/wrangler.toml` (add DO binding)
  - `src/services/terminal/CloudExecutor.ts` (rewrite for WS)
- **Acceptance**: `npm run dev` → terminal → `vim` works, session persists across reloads

### 1.2 Container Backend
- **Problem**: WASM runtimes can't run real tools
- **Solution**: Firecracker microVMs or gVisor sandbox via Cloudflare Workers AI / Railway / Render
- **Files**: Infrastructure (Terraform/Pulumi), executor DO spawns containers
- **Acceptance**: `npm install`, `git`, `docker`, `python -m venv` work in terminal

### 1.3 LSP Integration
- **Problem**: No language intelligence in terminal/editor
- **Solution**: `vscode-languageserver-protocol` over PTY, CodeMirror LSP client
- **Files**: `src/services/terminal/LSPClient.ts` (new), `src/components/editor/CodeEditor.tsx` (integrate)
- **Acceptance**: Go-to-definition, hover, diagnostics for TS/JS/Python

### 1.4 Terminal Multiplexer
- **Problem**: Single terminal session
- **Solution**: Tabs, splits, session restore, named sessions
- **Files**: `src/components/terminal/TerminalPanel.tsx` (enhance), `TerminalSession.ts` (session management)
- **Acceptance**: Multiple terminals, persist across project switches

---

## Phase 2: MCP Completeness (Weeks 3-5) — Full Spec

### 2.1 Missing MCP Features
| Feature | Spec Section | Effort |
|---------|--------------|--------|
| Resource subscriptions | `resources/subscribe` | Medium |
| Prompt templates | `prompts/list`, `prompts/get` | Low |
| Sampling (server→LLM) | `sampling/createMessage` | Medium |
| Progress notifications | `notifications/progress` | Low |
| Cancellation | `notifications/cancelled` | Low |

- **Files**: `src/services/ai/MCPClient.ts`, `MCPConfigStore.ts`
- **Acceptance**: All MCP Inspector tests pass

### 2.2 WASI Stdio Transport
- **Problem**: stdio only works via Termux bridge
- **Solution**: `wasm-component` + `wasi:cli/run` for local MCP servers
- **Files**: `src/services/ai/transports/WASITransport.ts` (new)
- **Acceptance**: Run `npx @modelcontextprotocol/server-filesystem` in browser WASM

### 2.3 MCP Marketplace
- **Problem**: Presets hardcoded in `MCPConfigStore.ts`
- **Solution**: Signed manifests, sandboxed install, auto-update, registry API
- **Files**: 
  - `src/services/ai/Marketplace.ts` (new)
  - `public/mcp-registry/` (JSON manifests)
  - Worker endpoint for registry
- **Acceptance**: User installs MCP server from UI, gets updates

### 2.4 OAuth for Remote MCP Servers
- **Problem**: Bearer tokens hardcoded in presets
- **Solution**: PKCE flow, token refresh, scope management, secure storage
- **Files**: `src/services/ai/MCPAuth.ts` (new), integrate with `CryptoVault`
- **Acceptance**: Connect to Notion/GitHub MCP via OAuth, tokens auto-refresh

---

## Phase 3: AI 2.0 (Weeks 4-6) — Provider Ecosystem

### 3.1 Provider Plugin System
- **Problem**: Providers hardcoded in `AIGateway.ts`
- **Solution**: Plugin interface, dynamic loading
- **Files**: 
  - `src/services/ai/providers/Provider.ts` (interface)
  - `src/services/ai/providers/{webllm,groq,openai,anthropic,openrouter,ollama,lmstudio,vllm,workers-ai}.ts`
  - `src/services/ai/ProviderRegistry.ts` (new)
- **Acceptance**: Add provider by dropping file, no core changes

### 3.2 Conversation Persistence
- **Problem**: History lost on reload
- **Solution**: IndexedDB + D1 sync, branching, full-text search
- **Files**: `src/services/ai/ConversationStore.ts` (new), D1 migration
- **Acceptance**: Conversations survive reload, searchable, branchable

### 3.3 RAG Integration
- **Problem**: `EmbeddingEngine` exists but unused
- **Solution**: Vector search over project files, inject context
- **Files**: `src/services/ai/RAGEngine.ts` (new), D1 vector or Pinecone
- **Acceptance**: "Ask about my codebase" works with citations

### 3.4 Agent Loops
- **Problem**: Single-turn tool calls
- **Solution**: Multi-step planning, self-correction, cost tracking
- **Files**: `src/services/ai/AgentRunner.ts` (new)
- **Acceptance**: "Refactor this module" → plans → executes → verifies

### 3.5 Model Routing
- **Problem**: Manual model selection
- **Solution**: Fallback chain, capability matching, cost/latency optimization
- **Files**: `src/services/ai/ModelRouter.ts` (new)
- **Acceptance**: Auto-selects best model for task

---

## Phase 4: Sync & Collab (Weeks 5-7) — CRDT Everywhere

### 4.1 CRDT Unification
- **Problem**: Yjs only for collab, not for settings/snippets/MCP
- **Solution**: Single Yjs doc per project, multiple awareness types
- **Files**: `src/services/sync/CRDTSync.ts` (new), providers for all mutable state
- **Acceptance**: All state syncs offline→online, conflict-free

### 4.2 Conflict Resolution UI
- **Problem**: `SyncQueue` exists but no UI
- **Solution**: 3-way merge for code, semantic merge for JSON, visual picker
- **Files**: `src/components/git/ConflictResolver.tsx` (new)
- **Acceptance**: Git conflicts resolved in-editor, MCP config conflicts merged

### 4.3 Real-Time Collab Deployment
- **Problem**: y-websocket needs signaling server
- **Solution**: Deploy signaling (Cloudflare Workers + DO), presence, cursors, voice
- **Files**: `devnoder-collab/` (new Worker), `src/services/collab/CollabService.ts` (enhance)
- **Acceptance**: Two users edit same file, see cursors, hear each other

### 4.4 Background Sync
- **Problem**: Manual sync only
- **Solution**: Service Worker + Periodic Sync API + Background Fetch
- **Files**: `src/sw.ts` (enhance), `src/services/sync/BackgroundSync.ts` (new)
- **Acceptance**: Edits sync when online, git pushes queued

---

## Phase 5: Mobile & PWA (Weeks 6-8) — True Mobile-First

### 5.1 Virtual Keyboard Handling
- **Problem**: Layout shifts, input focus loss
- **Solution**: `visualViewport` API, input padding, focus management
- **Files**: `src/hooks/useVirtualKeyboard.ts` (new), `BottomNav.tsx`, `CommandPalette.tsx`
- **Acceptance**: Keyboard opens → UI adapts, no overlap, focus preserved

### 5.2 Touch Gestures
- **Problem**: No swipe, pinch, long-press
- **Solution**: Panel swipe navigation, editor pinch zoom, context menus
- **Files**: `src/hooks/useGestures.ts` (new), `BottomNav.tsx`, `CodeEditor.tsx`
- **Acceptance**: Swipe between panels, pinch zoom editor, long-press = context menu

### 5.3 Haptics & Audio Cues
- **Problem**: `AudioCueService` exists but unused
- **Solution**: `navigator.vibrate()`, audio cues for save/error/complete
- **Files**: `src/services/accessibility/AudioCueService.ts` (integrate), `src/hooks/useHaptics.ts` (new)
- **Acceptance**: Tactile feedback on mobile actions

### 5.4 PWA Install Optimization
- **Problem**: Basic manifest only
- **Solution**: `beforeinstallprompt` UX, splash screens, shortcuts, update notifications
- **Files**: `vite.config.ts` (PWA config), `src/components/layout/InstallPrompt.tsx` (new)
- **Acceptance**: Install rate >5%, update notification works

### 5.5 App Store Builds
- **Problem**: Web-only
- **Solution**: Capacitor for iOS/Android, Tauri for desktop
- **Files**: `capacitor.config.ts`, `tauri.conf.json`, native plugins
- **Acceptance**: TestFlight build, Play Store internal test

---

## Phase 6: Extensibility (Weeks 7-9) — Plugin Ecosystem

### 6.1 Plugin Sandbox
- **Problem**: `PluginRegistry` uses eval, no isolation
- **Solution**: WebWorker + Comlink, manifest v3, permission system
- **Files**: 
  - `src/services/plugins/PluginSandbox.ts` (new)
  - `src/services/plugins/manifest.schema.json` (new)
  - `src/components/plugins/PluginPanel.tsx` (enhance)
- **Acceptance**: Plugin crashes don't kill host, permissions enforced

### 6.2 Plugin Marketplace
- **Problem**: No discovery
- **Solution**: Registry API, ratings, auto-update, revenue split
- **Files**: Worker marketplace API, `src/services/plugins/Marketplace.ts`
- **Acceptance**: Browse/install/update plugins from UI

### 6.3 Theme Marketplace
- **Problem**: `ThemeRegistry` scaffold only
- **Solution**: CSS variable themes, live preview, export/import
- **Files**: `src/services/community/ThemeRegistry.ts` (enhance), theme builder UI
- **Acceptance**: Create theme in UI, publish, others install

### 6.4 Snippet Sync
- **Problem**: Local only
- **Solution**: GitHub Gist + D1, versioning, sharing, collections
- **Files**: `src/services/snippets/SnippetService.ts` (enhance)
- **Acceptance**: Snippets sync across devices, public/private collections

---

## Phase 7: Observability & Ops (Weeks 8-10) — Production Ready

### 7.1 OpenTelemetry
- **Problem**: No traces/metrics
- **Solution**: OTel SDK in all Workers + frontend, export to Honeycomb/Datadog/Grafana
- **Files**: `src/services/telemetry/OTel.ts` (new), Worker instrumentation
- **Acceptance**: End-to-end traces for AI request, terminal session, sync

### 7.2 Error Tracking
- **Problem**: Console only
- **Solution**: Sentry integration with release tracking, source maps
- **Files**: `sentry.client.config.ts`, `sentry.server.config.ts`, CI upload
- **Acceptance**: Errors grouped, alerting on regressions

### 7.3 Feature Flags
- **Problem**: All-or-nothing deploys
- **Solution**: LaunchDarkly/Unleash integration
- **Files**: `src/services/flags/FeatureFlags.ts` (new)
- **Acceptance**: Roll out AI model to 10%, kill switch

### 7.4 A/B Testing
- **Problem**: No experimentation
- **Solution**: Assignment in ProjectContext, metric tracking
- **Files**: `src/services/experiments/Experiments.ts` (new)
- **Acceptance**: Test onboarding variants, measure activation

### 7.5 Cost Dashboards
- **Problem**: No cost visibility
- **Solution**: Track AI tokens, Worker CPU, D1 reads, R2 egress per project/user
- **Files**: `src/services/telemetry/CostTracking.ts` (new), dashboard
- **Acceptance**: Per-project cost breakdown, alerts at thresholds

---

## Cross-Cutting Concerns (Ongoing)

### Security Hardening
- [ ] CSP headers: `script-src 'self'`, `connect-src` restricted
- [ ] DOMPurify on all AI-rendered content
- [ ] `npm audit` + Snyk in CI, `pnpm` lockfile
- [ ] MCP server signed manifests, pinned versions
- [ ] Plugin sandbox: no eval, no network without permission
- [ ] Git credential helper, never log tokens
- [ ] D1 parameterized queries only

### Performance Budgets
- [ ] Bundle: <500KB gzipped initial
- [ ] TTI: <3s on 4G
- [ ] Lighthouse PWA: >90
- [ ] Bundle analyzer in CI with PR comment

### Documentation
- [ ] User guide (Docusaurus)
- [ ] Plugin author API docs
- [ ] Architecture Decision Records (ADRs)
- [ ] Contributing guide

---

## Milestone Gates

| Milestone | Criteria | Week |
|-----------|----------|------|
| **M0: Build Green** | `npm run build` passes, dev server stable | 1 |
| **M1: Testable** | Service registry, 5 service tests, CI gate | 2 |
| **M2: Real Terminal** | PTY works, `vim`/`git`/`npm` in terminal | 4 |
| **M3: MCP Complete** | Full spec, WASI transport, marketplace | 5 |
| **M4: AI 2.0** | Provider plugins, RAG, agents, routing | 6 |
| **M5: Sync Works** | CRDT everywhere, conflict UI, collab deployed | 7 |
| **M6: Mobile Native** | PWA install, gestures, haptics, app builds | 8 |
| **M7: Extensible** | Plugin sandbox, marketplace, themes | 9 |
| **M8: Production** | OTel, Sentry, flags, costs, docs | 10 |

---

## Resource Estimates

| Role | Weeks 1-2 | Weeks 3-5 | Weeks 6-8 | Weeks 9-10 |
|------|-----------|-----------|-----------|------------|
| Frontend (React/TS) | 1.5 | 1 | 1 | 0.5 |
| Workers/Backend (TS/Rust) | 0.5 | 2 | 1 | 1 |
| DevOps/Infra | 0.5 | 1 | 0.5 | 1 |
| QA/Testing | 0.5 | 0.5 | 1 | 1 |
| **Total** | **3** | **4.5** | **3.5** | **3.5** |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Cloudflare DO limits | Medium | High | Prototype early, have Railway fallback |
| WASI MCP transport complexity | High | Medium | Start with Termux-only, WASI as stretch |
| Mobile Safari PWA bugs | High | Medium | Test on real devices weekly |
| Plugin sandbox escape | Low | Critical | Security audit before marketplace launch |
| AI cost overruns | Medium | High | Hard limits per project, alerting |
| Sync data loss | Low | Critical | CRDT verification tests, backup to R2 |

---

## Definition of Done (Per Task)

- [ ] Code complete + self-reviewed
- [ ] Unit tests pass (>80% coverage for services)
- [ ] Integration test added (Playwright)
- [ ] TypeScript strict mode clean
- [ ] ESLint clean
- [ ] Documentation updated (README/ADR)
- [ ] Deployed to staging, verified
- [ ] Performance budget met
- [ ] Security review (if applicable)

---

## Next Steps

1. **Review & prioritize** — Team ranks phases/tasks
2. **Assign owners** — Each task needs a DRI
3. **Sprint 0** — Set up CI, test infra, service registry (Week 1)
4. **Weekly sync** — Monday planning, Friday demo/retro
5. **Monthly milestone review** — Adjust scope/timeline

---

*This plan is a living document. Update as we learn.*