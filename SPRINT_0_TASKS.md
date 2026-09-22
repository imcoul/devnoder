# Sprint 0: Foundation — Executable Task Breakdown

**Goal**: Unblock builds, establish testable architecture, single source of truth
**Duration**: Week 1-2
**Owner**: TBD

---

## Task 0.1: Fix Production Build (30 min)

### Problem
`vite build` fails: `Could not resolve "./8_5_8/php_8_5.wasm" from "@php-wasm/web-8-5"`

### Root Cause
`@php-wasm/web-8-5` sub-package missing WASM file in npm tarball

### Solution Options
**Option A (Quick)**: Pin to working version
```bash
npm uninstall @php-wasm/web-8-5
npm install @php-wasm/web@3.1.42
# Update imports in TerminalSession.ts, WASMRuntime.ts
```

**Option B (Robust)**: Dynamic CDN import + exclude from bundle
```typescript
// src/services/terminal/WASMRuntime.ts
const php = await import('https://cdn.jsdelivr.net/npm/@php-wasm/web@3.1.42');
```
```typescript
// vite.config.ts
optimizeDeps: {
  exclude: ['@php-wasm/web', '@php-wasm/web-8-5', '@php-wasm/universal']
}
```

### Acceptance
- [ ] `npm run build` succeeds
- [ ] `npm run dev` terminal PHP still works
- [ ] No TypeScript errors

### Files to Modify
- `package.json`
- `vite.config.ts`
- `src/services/terminal/WASMRuntime.ts` (if Option B)

---

## Task 0.2: Service Registry (2 hrs)

### Create Registry
```typescript
// src/services/registry.ts
type Factory<T> = () => T | Promise<T>;

interface ServiceRegistry {
  register<T>(key: string, factory: Factory<T>): void;
  get<T>(key: string): T;
  has(key: string): boolean;
  reset(): void;
}

class RegistryImpl implements ServiceRegistry {
  private factories = new Map<string, Factory<any>>();
  private instances = new Map<string, any>();

  register<T>(key: string, factory: Factory<T>) {
    if (this.factories.has(key)) {
      console.warn(`Service ${key} already registered, overwriting`);
    }
    this.factories.set(key, factory);
    this.instances.delete(key);
  }

  get<T>(key: string): T {
    if (this.instances.has(key)) return this.instances.get(key);
    const factory = this.factories.get(key);
    if (!factory) throw new Error(`Service ${key} not registered`);
    const instance = factory();
    this.instances.set(key, instance);
    return instance;
  }

  has(key: string) { return this.factories.has(key); }

  reset() {
    this.instances.clear();
  }
}

export const registry = new RegistryImpl();

// Convenience
export function registerService<T>(key: string, factory: Factory<T>) {
  registry.register(key, factory);
}

export function getService<T>(key: string): T {
  return registry.get(key);
}
```

### Migrate Services (Priority Order)
```typescript
// src/services/registry.ts - add at bottom
import { cryptoVault } from './security/CryptoVault';
import { mcpConfigStore } from './ai/MCPConfigStore';
import { aiGateway } from './ai/AIGateway';
import { gitHubAPI } from './git/GitHubAPI';
import { terminalSession } from './terminal/TerminalSession';
import { cloudExecutor } from './terminal/CloudExecutor';
import { embeddingEngine } from './ai/EmbeddingEngine';
import { templateService } from './templates/TemplateService';
import { projectService } from './project/ProjectService';
import { bufferManager } from './editor/BufferManager';
import { codeSyncEngine } from './visual/CodeSyncEngine';
// ... etc

registerService('cryptoVault', () => cryptoVault);
registerService('mcpConfigStore', () => mcpConfigStore);
registerService('aiGateway', () => aiGateway);
registerService('gitHubAPI', () => gitHubAPI);
registerService('terminalSession', () => terminalSession);
registerService('cloudExecutor', () => cloudExecutor);
registerService('embeddingEngine', () => embeddingEngine);
registerService('templateService', () => templateService);
registerService('projectService', () => projectService);
registerService('bufferManager', () => bufferManager);
registerService('codeSyncEngine', () => codeSyncEngine);
// ... rest
```

### Update Imports
Replace all `import { x } from './services/...'` with:
```typescript
import { getService } from './services/registry';
const x = getService('x');
```

### Acceptance
- [ ] All 25+ services registered
- [ ] `registry.reset()` works in tests
- [ ] No circular import errors
- [ ] Dev server works

### Files to Modify
- `src/services/registry.ts` (new)
- All service files (export singleton, remove direct imports)
- All consumer files (use `getService()`)

---

## Task 0.3: Unified ProjectContext (2 hrs)

### Create Store
```typescript
// src/stores/projectContext.ts
import { atom } from 'nanostores';
import type { ProjectRecord } from '../services/storage/db';
import type { FileStatus, Branch } from '../services/git/GitService';
import type { Buffer } from '../services/editor/BufferManager';
import type { MCPServerConfig } from '../services/ai/MCPConfigStore';

export interface ProjectContext {
  project: ProjectRecord | null;
  git: {
    status: FileStatus[];
    branches: Branch[];
    remote?: string;
    currentBranch?: string;
  };
  buffers: Buffer[];
  terminal: {
    cwd: string;
    env: Record<string, string>;
  };
  mcp: {
    connectedServers: MCPServerConfig[];
  };
  ui: {
    activePanel: string;
    sidebarOpen: boolean;
  };
}

export const $projectContext = atom<ProjectContext | null>(null);

// Derived atoms for backward compatibility
export const $activeProjectId = atom<string | null>(null);
export const $gitStatus = atom<FileStatus[]>([]);
export const $activeBuffer = atom<Buffer | null>(null);

// Subscribe to context changes
$projectContext.subscribe(ctx => {
  $activeProjectId.set(ctx?.project?.id ?? null);
  $gitStatus.set(ctx?.git.status ?? []);
  $activeBuffer.set(ctx?.buffers.find(b => b.id === ctx?.ui?.activePanel) ?? null);
});

export function setProjectContext(ctx: ProjectContext | null) {
  $projectContext.set(ctx);
}

export function updateProjectContext(patch: Partial<ProjectContext>) {
  const current = $projectContext.get();
  if (!current) return;
  $projectContext.set({ ...current, ...patch });
}
```

### Wire Up Consumers
- `ProjectService` → calls `setProjectContext()` on create/open/switch
- `GitService` → subscribes to `$projectContext`, updates git status
- `BufferManager` → subscribes, closes buffers on project switch
- `TerminalSession` → subscribes, updates cwd
- `MCPClient` → subscribes, connects project-scoped servers

### Acceptance
- [ ] Project switch updates all services atomically
- [ ] No stale state after switch
- [ ] Backward-compatible atoms work for existing components

### Files to Modify
- `src/stores/projectContext.ts` (new)
- `src/services/project/ProjectService.ts`
- `src/services/git/GitService.ts`
- `src/services/editor/BufferManager.ts`
- `src/services/terminal/TerminalSession.ts`
- `src/services/ai/MCPClient.ts`

---

## Task 0.4: VirtualFS (4 hrs)

### Design
```typescript
// src/services/fs/VirtualFS.ts
import { EventEmitter } from 'events';
import FS from '@isomorphic-git/lightning-fs';
import { db } from '../storage/db';

type ChangeEvent = { type: 'write' | 'delete' | 'mkdir'; path: string; content?: string };

class VirtualFS extends EventEmitter {
  private fs: FS;
  private projectId: string;
  private cache = new Map<string, string>();

  constructor(projectId: string) {
    super();
    this.projectId = projectId;
    this.fs = new FS(`devnoder-fs-${projectId}`);
  }

  async readFile(path: string): Promise<string> {
    const fullPath = this.resolve(path);
    // Check cache first
    if (this.cache.has(fullPath)) return this.cache.get(fullPath)!;
    // Check IndexedDB
    const record = await db.files.get({ projectId: this.projectId, path });
    if (record) return record.content;
    // Fallback to lightning-fs
    try {
      const content = await this.fs.promises.readFile(fullPath, 'utf8');
      this.cache.set(fullPath, content);
      return content;
    } catch {
      throw new Error(`File not found: ${path}`);
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    const fullPath = this.resolve(path);
    // Write to lightning-fs (for git)
    await this.ensureDir(fullPath);
    await this.fs.promises.writeFile(fullPath, content, 'utf8');
    // Write to IndexedDB (for editor)
    await db.files.put({ projectId: this.projectId, path, content, language: detectLang(path), updatedAt: Date.now() });
    // Cache
    this.cache.set(fullPath, content);
    // Emit
    this.emit('change', { type: 'write', path, content });
  }

  async deleteFile(path: string): Promise<void> {
    const fullPath = this.resolve(path);
    await this.fs.promises.unlink(fullPath).catch(() => {});
    await db.files.delete({ projectId: this.projectId, path });
    this.cache.delete(fullPath);
    this.emit('change', { type: 'delete', path });
  }

  async listFiles(path = ''): Promise<string[]> {
    const fullPath = this.resolve(path);
    // Merge lightning-fs + IndexedDB
    const fsFiles = await this.recurse(fullPath);
    const dbFiles = await db.files.where('projectId').equals(this.projectId).toArray();
    const all = new Set([...fsFiles, ...dbFiles.map(f => f.path)]);
    return Array.from(all);
  }

  // Git operations delegate to lightning-fs
  getGitFS() { return this.fs; }
  getGitDir() { return `/projects/${this.projectId}`; }

  private resolve(path: string) { return `/projects/${this.projectId}/${path}`; }
  private async ensureDir(filePath: string) { /* ... */ }
  private async recurse(dir: string) { /* ... */ }
}

function detectLang(path: string): string { /* ... */ }

export function createVirtualFS(projectId: string): VirtualFS {
  return new VirtualFS(projectId);
}
```

### Replace Direct `fs` Imports
```typescript
// src/services/git/GitService.ts
import { createVirtualFS } from '../fs/VirtualFS';

// Remove: export const fs = new FS('devnoder-fs');
// Replace getDir() with:
export function getVirtualFS(projectId: string) { return createVirtualFS(projectId); }

// All git functions take VirtualFS instance
export async function initRepo(vfs: VirtualFS): Promise<void> {
  const dir = vfs.getGitDir();
  // ... use vfs.getGitFS() instead of fs
}
```

### Wire to ProjectContext
```typescript
// In ProjectService.openProject()
const vfs = createVirtualFS(record.id);
// Store in context or pass to services
```

### Acceptance
- [ ] Single source of truth for file content
- [ ] Git operations work on same FS as editor
- [ ] Changes emit events for sync/RAG/AI
- [ ] No data loss on project switch

### Files to Modify
- `src/services/fs/VirtualFS.ts` (new)
- `src/services/git/GitService.ts` (major refactor)
- `src/services/templates/TemplateService.ts`
- `src/services/project/ProjectService.ts`

---

## Task 0.5: Test Infrastructure (2 hrs)

### Enhance vitest.config.ts
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setupTests.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 70,
        branches: 60,
        statements: 80,
      },
      // Only enforce on services
      include: ['src/services/**/*.ts'],
    },
  },
});
```

### Add Service Tests (5 minimum)
```typescript
// src/services/ai/MCPClient.test.ts (enhance)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mcpClient } from './MCPClient';
import { mcpConfigStore } from './MCPConfigStore';

// Mock transport
class MockTransport extends MCPTransport { /* ... */ }

describe('MCPClient', () => {
  beforeEach(() => {
    vi.resetModules();
    registry.reset();
  });

  it('connects to WebSocket server', async () => { /* ... */ });
  it('rejects servers with no capabilities', async () => { /* ... */ });
  it('lists tools after connect', async () => { /* ... */ });
  it('calls tool and returns result', async () => { /* ... */ });
  it('audits tool calls', async () => { /* ... */ });
});
```

```typescript
// src/services/git/GitService.test.ts (new)
import { describe, it, expect, beforeEach } from 'vitest';
import { initRepo, writeFile, readFile, getStatus, stageAll, commit } from './GitService';
import { createVirtualFS } from '../fs/VirtualFS';

describe('GitService', () => {
  let vfs: VirtualFS;

  beforeEach(() => {
    vfs = createVirtualFS(`test-${Date.now()}`);
  });

  it('initializes repo', async () => { /* ... */ });
  it('stages and commits file', async () => { /* ... */ });
  it('tracks file status', async () => { /* ... */ });
  it('handles project isolation', async () => { /* ... */ });
});
```

```typescript
// src/services/project/ProjectService.test.ts (new)
import { describe, it, expect, beforeEach } from 'vitest';
import { projectService } from './ProjectService';
import { createVirtualFS } from '../fs/VirtualFS';

describe('ProjectService', () => {
  beforeEach(() => registry.reset());

  it('creates project with template', async () => { /* ... */ });
  it('imports project from git URL', async () => { /* ... */ });
  it('switches projects atomically', async () => { /* ... */ });
});
```

```typescript
// src/services/security/CryptoVault.test.ts (new)
import { describe, it, expect } from 'vitest';
import { cryptoVault } from './CryptoVault';

describe('CryptoVault', () => {
  it('encrypts and decrypts', async () => { /* ... */ });
  it('returns null on tampered data', async () => { /* ... */ });
  it('persists key across reloads', async () => { /* ... */ });
});
```

```typescript
// src/services/ai/EmbeddingEngine.test.ts (new)
import { describe, it, expect } from 'vitest';
import { embeddingEngine } from './EmbeddingEngine';

describe('EmbeddingEngine', () => {
  it('generates embeddings', async () => { /* ... */ });
  it('schedules re-index on file change', async () => { /* ... */ });
  it('searches relevant files', async () => { /* ... */ });
});
```

### CI Workflow
```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --run --coverage
      - uses: codecov/codecov-action@v4
        if: github.event_name == 'pull_request'

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
        env:
          VITE_GITHUB_CLIENT_ID: ${{ secrets.VITE_GITHUB_CLIENT_ID }}
```

### Acceptance
- [ ] `npm test` passes locally
- [ ] CI runs on every PR
- [ ] Coverage thresholds enforced on services
- [ ] 5+ service tests passing

### Files to Create/Modify
- `vitest.config.ts` (enhance)
- `.github/workflows/test.yml` (new)
- `src/services/ai/MCPClient.test.ts` (enhance)
- `src/services/git/GitService.test.ts` (new)
- `src/services/project/ProjectService.test.ts` (new)
- `src/services/security/CryptoVault.test.ts` (new)
- `src/services/ai/EmbeddingEngine.test.ts` (new)
- `src/test/setupTests.ts` (ensure exists)

---

## Sprint 0 Definition of Done

- [ ] `npm run build` passes
- [ ] `npm run dev` works
- [ ] `npm test` passes with >80% service coverage
- [ ] CI pipeline green
- [ ] Service registry handles all 25+ services
- [ ] ProjectContext is single source of truth
- [ ] VirtualFS unifies editor + git filesystem
- [ ] All tasks have tests

---

## Sprint 1 Preview (Week 2-3)

| Task | Estimate | Depends On |
|------|----------|------------|
| 1.1 Durable Object Executor | 8 hrs | 0.1, 0.2 |
| 1.2 Container Backend | 16 hrs | 1.1 |
| 1.3 LSP Integration | 8 hrs | 1.1 |
| 1.4 Terminal Multiplexer | 4 hrs | 1.1 |

**Start 1.1 immediately after Sprint 0 M1 gate.**