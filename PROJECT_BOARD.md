# DevNoder Project Board Structure

## GitHub Projects (or Linear/Jira)

### Epics (Map to Phases)
| Epic | Issues | Status |
|------|--------|--------|
| Foundation | #1-#5 | 🟡 Sprint 0 |
| Terminal 2.0 | #6-#9 | ⏳ Sprint 1-2 |
| MCP Complete | #10-#13 | ⏳ Sprint 2-3 |
| AI 2.0 | #14-#18 | ⏳ Sprint 3-4 |
| Sync & Collab | #19-#22 | ⏳ Sprint 4-5 |
| Mobile & PWA | #23-#27 | ⏳ Sprint 5-6 |
| Extensibility | #28-#31 | ⏳ Sprint 6-7 |
| Observability | #32-#36 | ⏳ Sprint 7-8 |

---

## Sprint 0 Issues (Ready to Start)

### #1 Fix Production Build
**Labels**: `bug`, `blocker`, `sprint-0`
**Assignee**: TBD
**Acceptance**: `npm run build` passes
**Tasks**:
- [ ] Diagnose php-wasm WASM resolution error
- [ ] Choose Option A (pin) or B (CDN import)
- [ ] Update package.json + vite.config.ts
- [ ] Verify dev server terminal PHP works
- [ ] Run `npm run build` success

### #2 Service Registry
**Labels**: `refactor`, `sprint-0`, `architecture`
**Assignee**: TBD
**Acceptance**: All 25+ services registered, `registry.reset()` works
**Tasks**:
- [ ] Create `src/services/registry.ts`
- [ ] Register: cryptoVault, mcpConfigStore, aiGateway, gitHubAPI
- [ ] Register: terminalSession, cloudExecutor, embeddingEngine
- [ ] Register: templateService, projectService, bufferManager
- [ ] Register: codeSyncEngine, syncQueue, audioCueService
- [ ] Register: themeRegistry, computePool, finetuneExport
- [ ] Register: collabService, snippetService, secretDetector
- [ ] Register: projectHealthService, subscriptionService
- [ ] Register: pluginRegistry, pluginAPI, offlineDocsService
- [ ] Register: commitMessageAI
- [ ] Update all consumers to use `getService()`
- [ ] Verify no circular imports
- [ ] Add `registry.reset()` to test setup

### #3 Unified ProjectContext
**Labels**: `refactor`, `sprint-0`, `architecture`
**Assignee**: TBD
**Acceptance**: Project switch updates all services atomically
**Tasks**:
- [ ] Create `src/stores/projectContext.ts`
- [ ] Wire ProjectService → setProjectContext()
- [ ] Wire GitService → subscribe + update git status
- [ ] Wire BufferManager → subscribe + close on switch
- [ ] Wire TerminalSession → subscribe + update cwd
- [ ] Wire MCPClient → subscribe + connect project servers
- [ ] Add backward-compat derived atoms
- [ ] Test project switch in dev

### #4 VirtualFS
**Labels**: `refactor`, `sprint-0`, `architecture`, `high-risk`
**Assignee**: TBD
**Acceptance**: Single FS for editor + git, changes emit events
**Tasks**:
- [ ] Create `src/services/fs/VirtualFS.ts`
- [ ] Implement read/write/delete/list with dual persistence
- [ ] Add change event emitter
- [ ] Refactor GitService to use VirtualFS
- [ ] Refactor TemplateService to use VirtualFS
- [ ] Wire ProjectService to create VirtualFS per project
- [ ] Test: edit in editor → git status shows change
- [ ] Test: git checkout → editor updates

### #5 Test Infrastructure
**Labels**: `infra`, `sprint-0`, `testing`
**Assignee**: TBD
**Acceptance**: CI runs tests, >80% service coverage
**Tasks**:
- [ ] Enhance `vitest.config.ts` with coverage thresholds
- [ ] Create `.github/workflows/test.yml`
- [ ] Write MCPClient tests (5 cases)
- [ ] Write GitService tests (4 cases)
- [ ] Write ProjectService tests (3 cases)
- [ ] Write CryptoVault tests (3 cases)
- [ ] Write EmbeddingEngine tests (3 cases)
- [ ] Verify `npm test` passes locally
- [ ] Verify CI passes on PR

---

## Labels
```
priority:critical    # Blocks release
priority:high        # This sprint
priority:medium      # Next sprint
priority:low         # Backlog

type:bug
type:feature
type:refactor
type:infra
type:docs
type:security

area:terminal
area:ai
area:mcp
area:git
area:fs
area:mobile
area:plugins
area:collab
area:observability

sprint-0
sprint-1
sprint-2
...

risk:high
risk:medium
risk:low
```

---

## Definition of Ready (Issue Ready for Sprint)
- [ ] Clear acceptance criteria
- [ ] Design/approach agreed
- [ ] Dependencies identified
- [ ] Estimated (hours)
- [ ] Assigned owner
- [ ] Test plan sketched

## Definition of Done (Issue Complete)
- [ ] Code complete + self-reviewed
- [ ] Unit tests pass (>80% for services)
- [ ] Integration test added (Playwright)
- [ ] TypeScript strict clean
- [ ] ESLint clean
- [ ] Docs updated (README/ADR)
- [ ] Deployed to staging, verified
- [ ] Performance budget met
- [ ] Security review (if applicable)

---

## Weekly Cadence

### Monday: Sprint Planning (30 min)
- Review previous sprint demo
- Pull highest-priority ready issues
- Confirm capacity, assign owners
- Update project board

### Tuesday-Thursday: Execution
- Daily standup (async in Slack/GitHub)
- Pair on high-risk tasks
- Code review within 4 hours

### Friday: Demo + Retro (45 min)
- Live demo of completed work
- Retro: what worked, what didn't
- Update docs/ADRs
- Plan next sprint

---

## Communication
- **GitHub Issues**: All work tracked
- **GitHub Discussions**: Architecture decisions
- **Discord/Slack**: Daily coordination
- **Notion/Linear**: Sprint board view

---

## Release Process
1. **Weekly**: `main` → `staging` auto-deploy
2. **Bi-weekly**: `staging` → `production` (tagged release)
3. **Hotfix**: `main` → `production` (patch tag)
4. **Rollback**: Revert tag, redeploy previous

---

## Metrics Dashboard (Grafana/Datadog)
- Build success rate
- Test pass rate + coverage
- Deploy frequency
- Lead time (issue → deploy)
- MTTR (mean time to recovery)
- Error rate (Sentry)
- AI cost per project
- Active users (PWA installs)