# DevNoder — Execution Tracking & Branching Strategy

**Version**: 1.0 | **Date**: 2026-09-22

---

## Problem

We're executing multiple plans conjointly:
- Sprint 0-7 implementation plan
- OSS adoption plan
- Foundation refactors
- Feature development

Without isolation, a bad architectural decision or OSS incompatibility can contaminate everything.

---

## Solution: Layered Isolation

### 1. Git Branching Model

```
main (production-ready, always deployable)
├── develop (integration branch, CI green)
│   ├── feature/sprint-0-registry
│   ├── feature/sprint-0-virtualfs
│   ├── feature/sprint-1-sandbox-terminal
│   ├── feature/sprint-2-mcp-sdk
│   ├── feature/sprint-3-ai-providers
│   ├── feature/oss-yjs-collab
│   └── feature/oss-litellm
│
├── release/v1.0.0 (stabilization branch)
└── hotfix/* (emergency fixes from main)
```

**Rules**:
- `main` = always deployable, tagged releases only
- `develop` = integration branch, CI must be green
- `feature/*` = one feature per branch, short-lived (< 1 week)
- `release/*` = stabilization, only bug fixes
- `hotfix/*` = branched from `main`, merged to `main` + `develop`

### 2. Milestone Tags

```bash
# Tag each milestone
git tag -a m0-build-green -m "M0: Build passes, dev server stable"
git tag -a m1-testable -m "M1: Service registry, 5 tests, CI green"
git tag -a m2-real-terminal -m "M2: PTY works, vim/git/npm in terminal"
git tag -a m3-mcp-complete -m "M3: Full MCP spec, WASI transport, marketplace"
git tag -a m4-ai-20 -m "M4: Provider plugins, RAG, agents, routing"
git tag -a m5-sync-works -m "M5: CRDT everywhere, conflict UI, collab deployed"
git tag -a m6-mobile-native -m "M6: PWA install, gestures, haptics, app builds"
git tag -a m7-extensible -m "M7: Plugin sandbox, marketplace, themes"
git tag -a m8-production -m "M8: OTel, Sentry, flags, costs, docs"
```

**Recovery**: If Sprint 3 goes sideways, `git reset --hard m2-real-terminal` and we're back to a working state.

### 3. CHANGELOG.md

Track every change with:
- What changed
- Why it changed
- Who approved it
- How to revert it

```markdown
# Changelog

## [Unreleased]

### Added
- Service registry pattern (2026-09-22, @team)
  - Files: src/services/registry.ts, src/services/register.ts
  - Revert: git revert 60cf1d1
- ProjectContext store (2026-09-22, @team)
  - Files: src/stores/projectContext.ts, src/services/project/ProjectService.ts
  - Revert: git revert c4c6089
- VirtualFS abstraction (2026-09-22, @team)
  - Files: src/services/fs/VirtualFS.ts
  - Revert: git revert f882168
- Test infrastructure (2026-09-22, @team)
  - Files: vitest.config.ts, .github/workflows/test.yml, 5 test files
  - Revert: git revert d636fbf

### Changed
- OAuth Worker URL now configurable (2026-09-22, @team)
  - Files: src/services/git/GitHubAPI.ts, .env.example
  - Revert: git revert <commit>

### Fixed
- crypto.randomUUID polyfill (2026-09-22, @team)
  - Files: src/utils/crypto.ts, src/main.tsx
  - Revert: git revert <commit>

## [M0] - 2026-09-22
- Initial deployment, build fixed
```

### 4. Decision Log (ADR Lite)

Track architectural decisions with reversibility:

```markdown
# Decision Log

## 001: Service Registry Pattern (2026-09-22)
**Status**: Accepted
**Context**: 25+ global singletons, impossible to test, circular imports
**Decision**: Implement service registry with explicit registration
**Alternatives Considered**:
- Keep singletons (rejected: testing impossible)
- InversifyJS DI (rejected: too heavy for browser)
**Consequences**:
- Good: Testable, no circular imports, explicit dependencies
- Bad: Migration effort, all consumers must update
**Reversal**: `git revert` the registry commit, restore singletons
**Owner**: @team

## 002: Cloudflare Sandbox SDK for Terminal (2026-09-22)
**Status**: Proposed
**Context**: Custom WASM layer insufficient for real terminals
**Decision**: Evaluate Cloudflare Sandbox SDK (Apache-2.0)
**Alternatives Considered**:
- node-pty + Durable Object (higher effort, more control)
- Continue WASM-only (rejected: no real shell)
**Consequences**:
- Good: Real PTY, output buffering, reconnection
- Bad: Cloudflare dependency, cost, latency
**Reversal**: Keep WASM layer as fallback
**Owner**: @team
```

### 5. Feature Flags

Enable/disable features without deploys:

```typescript
// src/services/flags/FeatureFlags.ts
export interface FeatureFlags {
  // Sprint 0
  serviceRegistry: boolean;
  virtualFS: boolean;
  projectContext: boolean;
  
  // Sprint 1
  sandboxTerminal: boolean;
  realPTY: boolean;
  lspIntegration: boolean;
  
  // Sprint 2
  fullMCP: boolean;
  wasiTransport: boolean;
  mcpMarketplace: boolean;
  
  // Sprint 3
  providerPlugins: boolean;
  ragEngine: boolean;
  agentLoops: boolean;
  modelRouting: boolean;
  
  // Sprint 4
  crdtCollab: boolean;
  yjsEditorBinding: boolean;
  hocuspocusSignaling: boolean;
  conflictUI: boolean;
  
  // OSS adoption
  adoptSandboxSDK: boolean;
  adoptYjsCollab: boolean;
  adoptLiteLLM: boolean;
  adoptHocuspocus: boolean;
}

export const flags: FeatureFlags = {
  serviceRegistry: true,
  virtualFS: false, // behind flag until tested
  projectContext: false,
  sandboxTerminal: false,
  realPTY: false,
  lspIntegration: false,
  fullMCP: false,
  wasiTransport: false,
  mcpMarketplace: false,
  providerPlugins: false,
  ragEngine: false,
  agentLoops: false,
  modelRouting: false,
  crdtCollab: false,
  yjsEditorBinding: false,
  hocuspocusSignaling: false,
  conflictUI: false,
  adoptSandboxSDK: false,
  adoptYjsCollab: false,
  adoptLiteLLM: false,
  adoptHocuspocus: false,
};

export function isEnabled(flag: keyof FeatureFlags): boolean {
  return flags[flag];
}

export function setFlag(flag: keyof FeatureFlags, value: boolean) {
  flags[flag] = value;
  console.log(`[FeatureFlag] ${flag} = ${value}`);
}
```

**Usage in code**:
```typescript
import { isEnabled } from '../services/flags/FeatureFlags';

if (isEnabled('adoptSandboxSDK')) {
  // Use Cloudflare Sandbox SDK
} else {
  // Use existing WASM layer
}
```

### 6. Rollback Procedures

#### Quick Rollback (Single Feature)
```bash
# If Sprint 1 Terminal goes sideways
git checkout main
git tag -a rollback-sprint1 -m "Rollback to M0, Sprint 1 failed"
git push origin main rollback-sprint1

# Or selectively revert
git revert <commit-hash>
```

#### Full Rollback (Multiple Sprints)
```bash
# Reset to last known good milestone
git reset --hard m2-real-terminal
git push origin main --force

# WARNING: Only do this if you're the only one working on the branch
```

#### Partial Rollback (One Feature)
```bash
# Revert just the feature branch
git revert <commit1> <commit2> <commit3>

# Or use git cherry-pick to selectively apply
git cherry-pick <good-commit>
```

### 7. Progress Tracking

#### GitHub Projects Board

Columns:
- Backlog
- Ready (DoR met)
- In Progress
- In Review
- QA
- Done
- Blocked
- Rolled Back

Labels:
- `sprint-0` through `sprint-7`
- `oss-adoption`
- `priority:critical/high/medium/low`
- `risk:high/medium/low`
- `revert-risk:high` (hard to undo)

#### Weekly Status Email

```markdown
Subject: DevNoder Weekly Status — Sprint 0 Week 2

## Completed
- [x] Service registry (commit 60cf1d1)
- [x] Crypto polyfill + utilities (commit 2ff8226, d636fbf)
- [x] ProjectContext store (commit c4c6089)
- [x] VirtualFS abstraction (commit f882168)
- [x] Test infrastructure: vitest config, CI workflow, 5 tests (commit d636fbf)

## In Progress
- None — Sprint 0 tasks complete

## Next Week
- Sprint 1: Cloudflare Sandbox SDK evaluation
- Sprint 1: y-codemirror.next + Hocuspocus OSS adoption
- Sprint 1: Real PTY terminal

## Risks
- php-wasm build fix still shows build warnings (not blocking)
```

### 8. Emergency Procedures

#### If CI Breaks
```bash
# 1. Stop all feature branches
git checkout main
git revert <breaking-commit>
git push origin main

# 2. Notify team
# Post in #devnoder Slack: "CI broken, reverting to <commit>"

# 3. Investigate in feature branch
git checkout -b hotfix/ci-fix
# Fix the issue
git push origin hotfix/ci-fix
# Create PR to develop
```

#### If OSS Integration Fails
```bash
# 1. Disable feature flag
# In .env or FeatureFlags.ts
adoptSandboxSDK: false

# 2. Revert OSS-specific code
git revert <oss-adoption-commits>

# 3. Evaluate alternatives
# - Different OSS project
# - Custom implementation
# - Defer to later sprint

# 4. Document in Decision Log
```

#### If Architecture Decision Proves Wrong
```bash
# 1. Tag current state
git tag -a before-rearchitect -m "Before rearchitect"

# 2. Branch for rework
git checkout -b rearchitect/sprint-2

# 3. Implement new approach
# ...

# 4. If successful, merge to develop
# If failed, delete branch, resume from before-rearchitect
git checkout develop
git branch -D rearchitect/sprint-2
```

---

## Setup Commands

Run these now to establish the branching model:

```bash
# Create develop branch
git checkout -b develop
git push -u origin develop

# Create feature branches
git checkout -b feature/sprint-0-registry develop
git checkout -b feature/sprint-0-virtualfs develop
git checkout -b feature/sprint-0-projectcontext develop
git checkout -b feature/sprint-0-tests develop
git checkout develop

# Tag current state as M0
git tag -a m0-build-green -m "M0: Build passes, dev server stable"
git push origin m0-build-green

# Set up branch protection (GitHub)
gh repo edit --enable-branch-protection --branches main,develop
```

---

## Metrics to Track

| Metric | Target | Alert If |
|--------|--------|----------|
| CI pass rate | >95% | <90% for 1 hour |
| Feature branch age | <7 days | >14 days |
| Revert rate | <5% | >10% in a sprint |
| Build time | <5 min | >10 min |
| Test coverage | >80% | <70% |
| Feature flag usage | <20% active | >30% active (flag explosion) |

---

## Review Schedule

- **Daily**: Standup, blockers
- **Weekly**: Sprint planning, demo, retro
- **Bi-weekly**: Milestone review, adjust plan
- **Monthly**: Architecture review, OSS audit

---

*This is a living document. Update as we learn.*