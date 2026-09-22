# DevNoder Deep Development Plan — Open Source Audit & Incorporation Strategy

**Version**: 2.0 | **Date**: 2026-09-21 | **License**: AGPL-3.0-or-later

> **Purpose**: This document maps every major subsystem of DevNoder to battle-tested open-source projects, evaluates their compatibility with AGPL-3.0, and provides concrete incorporation plans. The goal is to stand on the shoulders of giants rather than reinvent wheels.

---

## AGPL-3.0 Compatibility Matrix

| License | AGPL-3.0 Compatible? | Notes |
|---------|---------------------|-------|
| MIT | ✅ Yes | Permissive, no copyleft |
| Apache-2.0 | ✅ Yes | Patent grant included, compatible |
| BSD-2-Clause | ✅ Yes | Permissive |
| BSD-3-Clause | ✅ Yes | Permissive |
| ISC | ✅ Yes | Functionally equivalent to MIT |
| MPL-2.0 | ✅ Yes | File-level copyleft, compatible |
| GPL-3.0 | ✅ Yes | Same terms as AGPL-3.0 |
| LGPL-3.0 | ✅ Yes | Can be combined |
| EPL-2.0 | ⚠️ Conditional | Compatible only with GPL-2.0-or-later exception, NOT AGPL-3.0 directly |
| AGPL-3.0 | ✅ Yes | Same license |
| SSPL | ❌ No | Not OSI-approved, AGPL-incompatible |
| BUSL/BSL | ❌ No | Source-available but not free software |

---

## Subsystem-by-Subsystem Analysis

### 1. Code Editor

#### Current State
- CodeMirror 6 (MIT)
- Custom language definitions
- Buffer manager with nanostores
- No LSP integration

#### Open Source References

| Project | License | Stars | What to Borrow |
|---------|---------|-------|---------------|
| [CodeMirror 6](https://github.com/codemirror/codemirror) | MIT | 4.5k | Core editor — already using |
| [y-codemirror.next](https://github.com/yjs/y-codemirror.next) | MIT | 206 | CRDT binding for CodeMirror 6 |
| [codemirror/collab](https://github.com/codemirror/collab) | MIT | 150 | Official collaborative editing |
| [@sebastianwessel/quickjs](https://github.com/sebastianwessel/quickjs) | MIT | 2.3k | Code execution sandbox |
| [Monaco Editor](https://github.com/microsoft/monaco-editor) | MIT | 39k | VS Code's editor, richer LSP story |
| [Eclipse Theia](https://github.com/eclipse-theia/theia) | EPL-2.0 | 21.7k | Full IDE framework (⚠️ license risk) |

#### Incorporation Plan

**Phase 1: Collaborative Editing (Week 2-3)**
```typescript
// src/components/editor/CodeEditor.tsx — current
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';

// → Enhanced with Yjs
import * as Y from 'yjs';
import { yCollab } from 'y-codemirror.next';
import { WebrtcProvider } from 'y-webrtc';
import { WebsocketProvider } from 'y-websocket';

const ydoc = new Y.Doc();
const ytext = ydoc.getText('code');

// Local-first: sync via WebRTC when possible
const provider = new WebsocketProvider('wss://sync.devnoder.io', projectId, ydoc);

// Fallback to cloud sync when offline
const awareness = provider.awareness;
awareness.setLocalStateField('user', { name, color });

const undoManager = new Y.UndoManager(ytext);

const state = EditorState.create({
  doc: ytext.toString(),
  extensions: [
    basicSetup,
    javascript(),
    yCollab(ytext, provider.awareness, { undoManager }),
  ],
});
```

**Source**: [yjs/y-codemirror.next](https://github.com/yjs/y-codemirror.next) — MIT license, drop-in replacement for our nanostores-based buffer state.

**Phase 2: LSP Integration (Week 4-5)**
```typescript
// src/services/editor/LSPClient.ts — new
import { LanguageClient } from 'vscode-languageclient/node';

export class LSPClient {
  private client: LanguageClient | null = null;

  async connect(socket: WebSocket, rootUri: string) {
    const transport = {
      send: (msg: string) => socket.send(msg),
      onMessage: (cb: (msg: string) => void) => {
        socket.onmessage = (e) => cb(e.data);
      },
    };
    this.client = new LanguageClient('devnoder-lsp', 'DevNoder LSP', {
      documentSelector: [{ scheme: 'file', language: 'typescript' }],
      connectionProvider: () => Promise.resolve(createConnection(transport)),
    }, { rootUri });
    await this.client.start();
  }

  async getDefinition(file: string, line: number, char: number) {
    return this.client?.send('textDocument/definition', { textDocument: { uri: file }, position: { line, character: char } });
  }
}
```

**Reference**: [vscode-languageserver-protocol](https://github.com/microsoft/vscode-languageserver-node) (MIT) — standard protocol, no licensing issues.

---

### 2. Terminal / Execution

#### Current State
- xterm.js (MIT) ✅
- Custom WASM runtimes (QuickJS, Pyodide, PHP)
- Cloudflare Worker HTTP fallback
- No real PTY

#### Open Source References

| Project | License | Stars | What to Borrow |
|---------|---------|-------|---------------|
| [xterm.js](https://github.com/xtermjs/xterm.js) | MIT | 18k | Terminal emulator — already using |
| [@xterm/addon-web-links](https://github.com/xtermjs/xterm.js) | MIT | — | Link detection addon |
| [@xterm/addon-fit](https://github.com/xtermjs/xterm.js) | MIT | — | Terminal fit addon — already using |
| [ttyd](https://github.com/tsl0922/ttyd) | MIT | 6.5k | Share terminal over web, node-pty backend |
| [Mike5941/WebTerminal](https://github.com/Mike5941/WebTerminal) | MIT | — | xterm.js + node-pty + ws |
| [Cloudflare Sandbox SDK](https://developers.cloudflare.com/sandbox/) | Apache-2.0/MIT | — | **PTY in Workers** |
| [@cloudflare/sandbox/xterm](https://developers.cloudflare.com/sandbox/guides/browser-terminals) | Apache-2.0 | — | Sandbox terminal addon |
| [node-pty](https://github.com/microsoft/node-pty) | MIT | 6.5k | Real PTY in Node.js |
| [gotty](https://github.com/yudai/gotty) | MIT | 13k | Terminal over WebSocket |
| [wetty](https://github.com/butlerx/wetty) | MIT | 2k | Terminal in browser |
| [@cloudflare/computer](https://github.com/cloudflare/computer) | Apache-2.0 | — | Agent runtime with workspace |
| [wasmedge-quickjs](https://github.com/second-state/wasmedge-quickjs) | Apache-2.0 | 562 | QuickJS in WASM via WasmEdge |

#### Incorporation Plan

**Phase 1: Cloudflare Sandbox Terminal (Week 2-3)**
```typescript
// src/services/terminal/CloudExecutor.ts — rewrite
import { SandboxAddon } from '@cloudflare/sandbox/xterm';

export const cloudExecutor = {
  async run(code: string, language: string): Promise<CloudResult> {
    const res = await fetch('/api/sandbox/terminal', {
      method: 'POST',
      body: JSON.stringify({ code, language }),
    });
    return res.json();
  },
};

// src/components/terminal/TerminalPanel.tsx — new
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SandboxAddon } from '@cloudflare/sandbox/xterm';

const terminal = new Terminal({ cursorBlink: true });
const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);

const addon = new SandboxAddon({
  getWebSocketUrl: ({ sandboxId, origin }) =>
    `${origin}/ws/terminal?id=${sandboxId}`,
  onStateChange: (state, error) => updateUI(state),
});
terminal.loadAddon(addon);
addon.connect({ sandboxId: 'devnoder-terminal' });
```

**Source**: [Cloudflare Sandbox SDK](https://developers.cloudflare.com/sandbox/) — Apache-2.0, gives us real PTY with output buffering, reconnection, and multiple isolated sessions per sandbox. This replaces the entire WASM runtime layer.

**Phase 2: Real PTY with node-pty (Week 4-6)**
```typescript
// devnoder-executor/src/TerminalDO.ts — new Durable Object
import { DurableObject } from 'cloudflare:workers';
import { spawn } from 'node-pty';

export class TerminalDO extends DurableObject {
  private sessions = new Map<string, WebSocket>();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/ws') {
      const [client, server] = Object.values(new WebSocketPair());
      const sessionId = crypto.randomUUID();
      
      const pty = spawn('bash', [], {
        cwd: '/home/user',
        env: process.env,
      });
      
      pty.onData((data) => server.send(data));
      server.addEventListener('message', (e) => pty.write(e.data));
      
      this.sessions.set(sessionId, server);
      return new Response(null, { status: 101, webSocket: client });
    }
    
    return new Response('Not found', { status: 404 });
  }
}
```

**Source**: [node-pty](https://github.com/microsoft/node-pty) (MIT) + [cloudflare/durable-objects-template](https://github.com/cloudflare/durable-objects-template) (Apache-2.0).

**Phase 3: WASM Execution Layer (Week 6-8)**
```typescript
// src/services/execution/ExecutionEngine.ts — new
interface ExecutionBackend {
  name: string;
  execute(code: string, language: string): Promise<ExecutionResult>;
}

class WasmEdgeBackend implements ExecutionBackend {
  name = 'wasmedge';
  
  async execute(code: string, language: string): Promise<ExecutionResult> {
    // Delegate to @cloudflare/computer Workspace
    const result = await workspace.exec({
      cmd: language === 'python' ? ['python3', '-c', code] : ['node', '-e', code],
      timeout: 10000,
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
  }
}

class PyodideBackend implements ExecutionBackend {
  name = 'pyodide';
  private pyodide: any;
  
  async init() {
    this.pyodide = await loadPyodide();
  }
  
  async execute(code: string): Promise<ExecutionResult> {
    try {
      const result = await this.pyodide.runPythonAsync(code);
      return { stdout: String(result), stderr: '', exitCode: 0 };
    } catch (e: any) {
      return { stdout: '', stderr: e.message, exitCode: 1 };
    }
  }
}
```

**Source**: [pyodide](https://github.com/pyodide/pyodide) (MPL-2.0), [@sebastianwessel/quickjs](https://github.com/sebastianwessel/quickjs) (MIT).

---

### 3. Git Integration

#### Current State
- isomorphic-git (MIT) ✅
- lightning-fs (MIT) ✅
- GitHub API client
- No merge conflict UI

#### Open Source References

| Project | License | Stars | What to Borrow |
|---------|---------|-------|---------------|
| [isomorphic-git](https://github.com/isomorphic-git/isomorphic-git) | MIT | 8.3k | Git in browser — already using |
| [lightning-fs](https://github.com/isomorphic-git/lightning-fs) | MIT | 611 | Browser filesystem — already using |
| [simple-git](https://github.com/steveukx/git-js) | MIT | 3.5k | Node git wrapper |
| [git-diff](https://github.com/kpdecker/jsdiff) | BSD-3 | 5.5k | Diff algorithm |
| [monaco-graphql](https://github.com/graphql/graphiql) | MIT | — | Diff viewer patterns |

#### Incorporation Plan

**Phase 1: VirtualFS Unification (Week 1-2)**
Already planned in Sprint 0. Replace dual IndexedDB + lightning-fs with unified layer.

**Phase 2: Merge Conflict UI (Week 5-6)**
```typescript
// src/components/git/MergeConflictResolver.tsx — new
import { DiffEditor } from '@monaco-editor/react';
import { diffLines } from 'diff';

export function MergeConflictResolver({ conflicts }: { conflicts: Conflict[] }) {
  return (
    <div className="merge-resolver">
      {conflicts.map((conflict, i) => (
        <div key={i} className="conflict">
          <div className="conflict-header">
            <span>{conflict.file}</span>
            <button onClick={() => resolveOurs(i)}>Ours</button>
            <button onClick={() => resolveTheirs(i)}>Theirs</button>
            <button onClick={() => resolveManual(i)}>Manual</button>
          </div>
          <DiffEditor
            height={300}
            language={detectLang(conflict.file)}
            original={conflict.ours}
            modified={conflict.theirs}
            options={{ readOnly: true }}
          />
        </div>
      ))}
    </div>
  );
}
```

**Source**: [jsdiff](https://github.com/kpdecker/jsdiff) (BSD-3) for diff algorithm, [@monaco-editor/react](https://github.com/suren-atoyan/monaco-react) (MIT) for 3-pane merge view.

---

### 4. CRDT / Real-Time Collaboration

#### Current State
- Yjs (MIT) ✅
- y-websocket (MIT) ✅
- CollabService scaffold
- No signaling server deployed

#### Open Source References

| Project | License | Stars | What to Borrow |
|---------|---------|-------|---------------|
| [Yjs](https://github.com/yjs/yjs) | MIT | 19k | CRDT engine — already using |
| [y-websocket](https://github.com/yjs/y-websocket) | MIT | 800 | WebSocket provider — already using |
| [y-webrtc](https://github.com/yjs/y-webrtc) | MIT | 400 | P2P provider |
| [y-indexeddb](https://github.com/yjs/y-indexeddb) | MIT | 350 | IndexedDB persistence — already using |
| [y-codemirror.next](https://github.com/yjs/y-codemirror.next) | MIT | 206 | Editor binding |
| [y-prosemirror](https://github.com/yjs/y-prosemirror) | MIT | 350 | Rich text binding |
| [liveblocks](https://github.com/liveblocks/liveblocks) | AGPL-3.0 | 2.5k | Full collab platform (⚠️ same license) |
| [PartyKit](https://github.com/partykit/partykit) | MIT | 3.5k | Collab backend |
| [Hocuspocus](https://github.com/ueberdosis/hocuspocus) | MIT | 2.5k | Yjs WebSocket server |

#### Incorporation Plan

**Phase 1: Deploy Signaling (Week 5)**
```typescript
// devnoder-collab/src/index.ts — new Worker
import { Hocuspocus } from '@hocuspocus/server';

const server = new Hocuspocus({
  port: 1234,
  async onAuthenticate(data) {
    // Verify GitHub token from session
    const token = data.token;
    if (!token) throw new Error('Unauthorized');
    return {
      user: { id: await verifyGitHubToken(token) },
    };
  },
  async onStoreDocument(data) {
    // Persist to D1
    await env.DB.prepare(
      'INSERT OR REPLACE INTO documents (id, content) VALUES (?, ?)'
    ).bind(data.documentName, JSON.stringify(data.state)).run();
  },
});
```

**Source**: [Hocuspocus](https://github.com/ueberdosis/hocuspocus) (MIT) — production-ready Yjs server with persistence, auth, and presence.

**Phase 2: Multi-Entity CRDT (Week 6-7)**
```typescript
// src/services/sync/ProjectSync.ts — new
class ProjectSync {
  private ydoc: Y.Doc;
  
  constructor(projectId: string) {
    this.ydoc = new Y.Doc();
    
    // One Y.Map per entity type
    this.files = this.ydoc.getMap('files');
    this.settings = this.ydoc.getMap('settings');
    this.snippets = this.ydoc.getMap('snippets');
    this.mcpConfigs = this.ydoc.getMap('mcpConfigs');
    this.conversations = this.ydoc.getMap('conversations');
    
    // Awareness for presence
    this.awareness = new Awareness(this.ydoc);
  }
  
  connect(provider: WebsocketProvider) {
    provider.connect();
    this.syncLocalChanges();
  }
  
  private syncLocalChanges() {
    // Bidirectional sync: IndexedDB ←→ Yjs
    yIndexedDB.persist(this.ydoc);
  }
}
```

**Source**: [yjs](https://github.com/yjs/yjs) ecosystem — MIT, battle-tested with 19k stars.

---

### 5. AI / LLM Integration

#### Current State
- Multi-provider gateway (Groq, OpenAI, Anthropic, OpenRouter, WebLLM)
- MCP tool calling
- No RAG, no agent loops

#### Open Source References

| Project | License | Stars | What to Borrow |
|---------|---------|-------|---------------|
| [Continue.dev](https://github.com/continuedev/continue) | Apache-2.0 | 35.8k | AI coding assistant, provider abstraction |
| [Aider](https://github.com/Aider-AI/aider) | Apache-2.0 | 48.7k | AI pair programming, agent loops |
| [Cloudflare Agents SDK](https://github.com/cloudflare/agents) | MIT | 5.5k | Agents on Workers, MCP, state |
| [LangChain](https://github.com/langchain-ai/langchain) | MIT | 115k | Agent framework, tool calling |
| [LangGraph](https://github.com/langchain-ai/langgraph) | MIT | 15k | Stateful agent graphs |
| [Vercel AI SDK](https://github.com/vercel/ai) | MIT | 10k | Streaming UI, tool calling |
| [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) | MIT | — | Agent primitives |
| [CrewAI](https://github.com/crewAIInc/crewAI) | MIT | 25k | Multi-agent orchestration |
| [AutoGen](https://github.com/microsoft/autogen) | MIT | 35k | Multi-agent conversation |
| [RAGFlow](https://github.com/infiniflow/ragflow) | AGPL-3.0 | 50k | RAG pipeline (same license) |
| [Dify](https://github.com/langgenius/dify) | Apache-2.0 | 95k | LLM app platform |
| [Flowise](https://github.com/FlowiseAI/Flowise) | Apache-2.0 | 32k | LLM workflow builder |
| [LiteLLM](https://github.com/BerriAI/litellm) | MIT | 25k | Unified LLM API |
| [Open WebUI](https://github.com/open-webui/open-webui) | MIT | 55k | Web UI for LLMs |
| [Ollama](https://github.com/ollama/ollama) | MIT | 110k | Local LLM runtime |

#### Incorporation Plan

**Phase 1: Provider Abstraction (Week 4-5)**
```typescript
// src/services/ai/providers/Provider.ts — new
export interface LLMProvider {
  id: string;
  name: string;
  models: ModelConfig[];
  stream(messages, tools, onChunk, signal): Promise<void>;
  countTokens(messages): Promise<number>;
  validateKey(key: string): Promise<boolean>;
}

// src/services/ai/providers/OllamaProvider.ts — new
export class OllamaProvider implements LLMProvider {
  id = 'ollama';
  name = 'Ollama (Local)';
  baseUrl: string;
  
  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }
  
  async stream(messages, tools, onChunk, signal) {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      body: JSON.stringify({ model: this.model, messages, stream: true, tools }),
      signal,
    });
    // ... stream handling
  }
}

// src/services/ai/ProviderRegistry.ts — new
export class ProviderRegistry {
  private providers = new Map<string, LLMProvider>();
  
  register(provider: LLMProvider) {
    this.providers.set(provider.id, provider);
  }
  
  get(id: string) { return this.providers.get(id); }
  getAll() { return Array.from(this.providers.values()); }
}
```

**Source**: [Continue.dev](https://github.com/continuedev/continue) (Apache-2.0) — provider abstraction pattern, autocomplete architecture.

**Phase 2: RAG Engine (Week 5-6)**
```typescript
// src/services/ai/RAGEngine.ts — new
export class RAGEngine {
  private vectorize: Vectorize;
  
  async indexFile(projectId: string, path: string, content: string) {
    const chunks = this.chunk(content, 512);
    const embeddings = await this.embed(chunks);
    await this.vectorize.insert(embeddings.map((e, i) => ({
      id: `${projectId}:${path}:${i}`,
      values: e,
      metadata: { projectId, path, chunkIndex: i },
    })));
  }
  
  async search(projectId: string, query: string, k = 10) {
    const embedding = await this.embed(query);
    const results = await this.vectorize.query(embedding, {
      topK: k,
      filter: { projectId },
    });
    return results.matches.map(m => ({
      path: m.metadata.path,
      content: this.reconstruct(m.metadata),
      score: m.score,
    }));
  }
  
  private chunk(text: string, size: number): string[] {
    // Sliding window with overlap
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += size * 0.75) {
      chunks.push(text.slice(i, i + size));
    }
    return chunks;
  }
  
  private async embed(texts: string[]): Promise<number[][]> {
    // Use Cloudflare Workers AI embedding model
    const res = await fetch('/api/embed', {
      method: 'POST',
      body: JSON.stringify({ texts }),
    });
    return res.json();
  }
}
```

**Source**: [RAGFlow](https://github.com/infiniflow/ragflow) (AGPL-3.0) — chunking strategies, ranking algorithms.

**Phase 3: Agent Loops (Week 6-7)**
```typescript
// src/services/ai/AgentRunner.ts — new
export interface AgentStep {
  thought: string;
  action: ToolCall | null;
  observation: string;
}

export class AgentRunner {
  async run(task: string, context: ProjectContext): Promise<AgentStep[]> {
    const steps: AgentStep[] = [];
    let remaining = task;
    
    while (remaining) {
      const prompt = this.buildPrompt(remaining, context, steps);
      const response = await this.llm.stream(prompt);
      
      // Parse agent's thought process
      const thought = this.extractThought(response);
      const action = this.extractAction(response);
      
      if (action) {
        const observation = await this.executeTool(action);
        steps.push({ thought, action, observation });
        remaining = this.planNextStep(steps);
      } else {
        steps.push({ thought, action: null, observation: '' });
        break;
      }
    }
    
    return steps;
  }
  
  private buildPrompt(task: string, ctx: ProjectContext, history: AgentStep[]): string {
    return `
You are an AI coding assistant working on project "${ctx.project.name}".

## Current Files
${ctx.buffers.map(b => `### ${b.path}\n\`\`\`${b.language}\n${b.content.slice(0, 500)}\n\`\`\``).join('\n')}

## Available Tools
${this.getAvailableToolsDescription()}

## Task
${task}

## Previous Steps
${history.map(s => `### Thought: ${s.thought}\n### Action: ${s.action ? `${s.action.name}(${JSON.stringify(s.action.args)})` : 'None'}\n### Observation: ${s.observation}`).join('\n')}

Respond with your next thought and action.
    `.trim();
  }
}
```

**Source**: [Aider](https://github.com/Aider-AI/aider) (Apache-2.0) — agent loop patterns, repo-map context, edit format.

---

### 6. PWA / Offline

#### Current State
- vite-plugin-pwa (MIT) ✅
- Workbox (Apache-2.0) ✅
- Basic manifest only

#### Open Source References

| Project | License | Stars | What to Borrow |
|---------|---------|-------|---------------|
| [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) | MIT | 5.5k | PWA plugin — already using |
| [Workbox](https://github.com/GoogleChrome/workbox) | Apache-2.0 | 12k | Service worker utilities |
| [XenOS](https://github.com/NebulaServices/XenOS) | AGPL-3.0 | 21 | WebOS patterns |
| [PWABuilder](https://github.com/pwa-builder/PWABuilder) | MIT | 3.5k | PWA tooling |
| [@angular/service-worker](https://github.com/angular/angular) | MIT | 96k | Service worker patterns |

#### Incorporation Plan

**Phase 1: Enhanced PWA (Week 6-7)**
```typescript
// src/sw.ts — enhance
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

precacheAndRoute(self.__WB_MANIFEST);

// Cache static assets
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({ cacheName: 'images', plugins: [new ExpirationPlugin({ maxEntries: 100 })] })
);

// API: network first, fall back to cache
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({ cacheName: 'api', networkTimeoutSeconds: 3 })
);

// AI models: cache first (large WASM files)
registerRoute(
  ({ url }) => url.hostname.includes('huggingface.co'),
  new CacheFirst({ cacheName: 'ai-models' })
);

// Background sync for git operations
self.addEventListener('sync', (event) => {
  if (event.tag === 'git-push') {
    event.waitUntil(backgroundGitPush());
  }
});
```

**Source**: [Workbox](https://github.com/GoogleChrome/workbox) (Apache-2.0) — production-grade service worker patterns.

---

### 7. MCP Ecosystem

#### Current State
- Custom MCP client with 3 transports
- 6 presets hardcoded
- No marketplace

#### Open Source References

| Project | License | Stars | What to Borrow |
|---------|---------|-------|---------------|
| [modelcontextprotocol](https://github.com/modelcontextprotocol/modelcontextprotocol) | MIT → Apache-2.0 | 10k+ | Spec, reference impls |
| [MCP Servers](https://github.com/modelcontextprotocol/servers) | MIT/Apache-2.0 | 10k+ | Reference server implementations |
| [cloudflare/agents](https://github.com/cloudflare/agents) | MIT | 5.5k | MCP server/client on Workers |
| [AnkiMCP](https://github.com/ankimcp/anki-mcp-server-addon) | AGPL-3.0 | — | MCP + local daemon |
| [code-context-provider-mcp](https://github.com/ab498/code-context-provider-mcp) | MIT | 20 | WASM tree-sitter for MCP |
| [contextpulse](https://github.com/ContextPulse/contextpulse) | AGPL-3.0 | 1 | MCP daemon patterns |

#### Incorporation Plan

**Phase 1: Full MCP Spec (Week 3-4)**
Already planned. Reference the [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) (Apache-2.0).

**Phase 2: MCP Marketplace (Week 7-8)**
```typescript
// src/services/ai/Marketplace.ts — new
interface MarketplaceManifest {
  id: string;
  name: string;
  description: string;
  icon: string;
  version: string;
  author: string;
  license: string;
  transport: 'stdio' | 'websocket' | 'sse';
  command?: string;
  url?: string;
  capabilities: MCPCapability[];
  signature: string; // Ed25519 signed
  downloads: number;
  rating: number;
}

export class Marketplace {
  async search(query: string): Promise<MarketplaceManifest[]> {
    const res = await fetch(`https://marketplace.devnoder.io/api/servers?q=${query}`);
    return res.json();
  }
  
  async install(manifest: MarketplaceManifest) {
    // Verify signature
    const verified = await this.verifySignature(manifest);
    if (!verified) throw new Error('Untrusted manifest');
    
    // Check capabilities
    const granted = await this.requestConsent(manifest);
    if (!granted) throw new Error('Consent denied');
    
    // Install
    await mcpConfigStore.add({
      id: manifest.id,
      name: manifest.name,
      icon: manifest.icon,
      transport: manifest.transport,
      command: manifest.command,
      url: manifest.url,
      capabilities: manifest.capabilities,
      enabled: true,
      addedAt: Date.now(),
    });
  }
  
  private async verifySignature(manifest: MarketplaceManifest): Promise<boolean> {
    // Ed25519 verification against DevNoder's public key
    return true; // placeholder
  }
}
```

**Source**: [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) (MIT/Apache-2.0) — reference implementations.

---

### 8. AI Provider Ecosystem

#### Current State
- 13 models hardcoded
- No Ollama/LM Studio/vLLM
- No provider plugins

#### Open Source References

| Project | License | Stars | What to Borrow |
|---------|---------|-------|---------------|
| [Continue.dev](https://github.com/continuedev/continue) | Apache-2.0 | 35.8k | Provider abstraction |
| [LiteLLM](https://github.com/BerriAI/litellm) | MIT | 25k | Unified LLM API, 100+ models |
| [Open WebUI](https://github.com/open-webui/open-webui) | MIT | 55k | Ollama UI patterns |
| [Ollama](https://github.com/ollama/ollama) | MIT | 110k | Local LLM runtime |
| [vLLM](https://github.com/vllm-project/vllm) | Apache-2.0 | 35k | High-throughput LLM serving |
| [llama.cpp](https://github.com/ggerganov/llama.cpp) | MIT | 40k | GGML inference |
| [MLC LLM](https://github.com/mlc-ai/mlc-llm) | Apache-2.0 | 15k | WebLLM backend |
| [WebLLM](https://github.com/mlc-ai/web-llm) | Apache-2.0 | 6k | In-browser LLM — already using |
| [Transformers.js](https://github.com/huggingface/transformers.js) | MIT | 15k | HuggingFace in browser |

#### Incorporation Plan

**Phase 1: LiteLLM-Style Provider (Week 4-5)**
```typescript
// src/services/ai/providers/LiteLLMProvider.ts — new
export class LiteLLMProvider implements LLMProvider {
  id = 'litellm';
  name = 'LiteLLM Proxy';
  baseUrl: string;
  
  async stream(messages, tools, onChunk, signal) {
    // LiteLLM exposes OpenAI-compatible API
    // Supports 100+ models through unified interface
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
        tools,
      }),
      signal,
    });
    // ... stream handling
  }
}

// src/services/ai/ProviderRegistry.ts — new
export const registry = new ProviderRegistry();
registry.register(new OpenAIProvider());
registry.register(new AnthropicProvider());
registry.register(new GroqProvider());
registry.register(new OllamaProvider({ baseUrl: 'http://localhost:11434' }));
registry.register(new LiteLLMProvider({ baseUrl: 'http://localhost:4000' }));
registry.register(new WebLLMProvider());
registry.register(new WorkersAIProvider());
```

**Source**: [LiteLLM](https://github.com/BerriAI/litellm) (MIT) — 100+ models through one interface.

**Phase 2: Model Routing (Week 6-7)**
```typescript
// src/services/ai/ModelRouter.ts — new
export class ModelRouter {
  async selectModel(task: Task): Promise<ModelConfig> {
    // Capability matching
    const capable = MODELS.filter(m => {
      if (task.requiresVision && !m.supportsVision) return false;
      if (task.contextLength > m.contextWindow) return false;
      if (task.requiresTools && !m.supportsTools) return false;
      return true;
    });
    
    // Cost optimization
    const sorted = capable.sort((a, b) => {
      if (task.priority === 'cost') return (a.costPer1k ?? 0) - (b.costPer1k ?? 0);
      if (task.priority === 'latency') return a.latencyP50 - b.latencyP50;
      return 0;
    });
    
    return sorted[0] ?? MODELS[0];
  }
  
  async fallbackChain(model: ModelConfig, task: Task): Promise<ModelConfig[]> {
    return MODELS.filter(m => 
      m.provider !== model.provider && this.canHandle(m, task)
    ).slice(0, 3);
  }
}
```

**Source**: [LiteLLM](https://github.com/BerriAI/litellm) routing patterns (MIT).

---

## Incorporation Priority Matrix

| Subsystem | OSS Project | License | Effort | Impact | Priority |
|-----------|------------|---------|--------|--------|----------|
| Terminal | Cloudflare Sandbox SDK | Apache-2.0 | 8 hrs | Critical | P0 |
| Terminal | xterm.js + SandboxAddon | MIT/Apache-2.0 | 4 hrs | Critical | P0 |
| Terminal | node-pty + DO | MIT | 8 hrs | Critical | P1 |
| Editor | y-codemirror.next | MIT | 4 hrs | High | P1 |
| Editor | Monaco Editor | MIT | 16 hrs | Medium | P2 |
| Git | jsdiff | BSD-3 | 4 hrs | Medium | P2 |
| Collab | Hocuspocus | MIT | 8 hrs | High | P1 |
| AI | LiteLLM | MIT | 4 hrs | High | P1 |
| AI | Continue.dev patterns | Apache-2.0 | 8 hrs | High | P1 |
| AI | RAGFlow patterns | AGPL-3.0 | 8 hrs | High | P1 |
| AI | LangGraph | MIT | 8 hrs | Medium | P2 |
| PWA | Workbox | Apache-2.0 | 4 hrs | Medium | P2 |
| MCP | MCP TypeScript SDK | Apache-2.0 | 8 hrs | High | P1 |
| Visual | GrapesJS | BSD-3 | — | — | Already using |
| FS | LightningFS | MIT | — | — | Already using |

---

## Weekly Sprint Plan with OSS

### Sprint 0: Foundation (Week 1-2)
- **Task 0.1**: Fix php-wasm build (30 min)
- **Task 0.2**: Service Registry (2 hrs) — no OSS needed, internal pattern
- **Task 0.3**: ProjectContext (2 hrs) — no OSS needed
- **Task 0.4**: VirtualFS (4 hrs) — no OSS needed
- **Task 0.5**: Test Infrastructure (2 hrs) — no OSS needed

### Sprint 1: Terminal 2.0 (Week 2-4)
- **Task 1.1**: **Adopt Cloudflare Sandbox SDK** (Apache-2.0, 8 hrs)
  - `npm install @cloudflare/sandbox @cloudflare/sandbox/xterm`
  - Rewrite `CloudExecutor.ts` to use SandboxAddon
  - Deploy Worker with sandbox binding
- **Task 1.2**: **Deploy node-pty Durable Object** (MIT + Apache-2.0, 8 hrs)
  - Fork from [Mike5941/WebTerminal](https://github.com/Mike5941/WebTerminal)
  - Adapt to Cloudflare DO pattern
  - Session persistence via DO storage
- **Task 1.3**: LSP Integration (8 hrs) — [vscode-languageserver-node](https://github.com/microsoft/vscode-languageserver-node) (MIT)
- **Task 1.4**: Terminal Multiplexer (4 hrs) — no OSS needed

### Sprint 2: MCP Complete (Week 3-5)
- **Task 2.1**: Full MCP Spec (8 hrs) — [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) (Apache-2.0)
- **Task 2.2**: WASI Stdio Transport (8 hrs) — [wasmedge-quickjs](https://github.com/second-state/wasmedge-quickjs) (Apache-2.0)
- **Task 2.3**: MCP Marketplace (8 hrs) — custom + [MCP servers](https://github.com/modelcontextprotocol/servers) patterns
- **Task 2.4**: OAuth for MCP (8 hrs) — custom implementation

### Sprint 3: AI 2.0 (Week 4-6)
- **Task 3.1**: **Adopt LiteLLM** (MIT, 4 hrs)
  - `npm install litellm`
  - Provider registry pattern from Continue.dev (Apache-2.0)
- **Task 3.2**: Conversation Persistence (8 hrs) — no OSS needed
- **Task 3.3**: **RAG with RAGFlow patterns** (AGPL-3.0, 8 hrs)
  - Chunking: sliding window with overlap
  - Embedding: Cloudflare Workers AI + Vectorize
  - Ranking: hybrid BM25 + cosine similarity
- **Task 3.4**: Agent Loops (8 hrs) — [Aider](https://github.com/Aider-AI/aider) patterns (Apache-2.0)
- **Task 3.5**: Model Routing (8 hrs) — LiteLLM patterns (MIT)

### Sprint 4: Sync & Collab (Week 5-7)
- **Task 4.1**: **Deploy Hocuspocus** (MIT, 8 hrs)
  - `npm install @hocuspocus/server`
  - D1 persistence for documents
  - GitHub OAuth for auth
- **Task 4.2**: **y-codemirror.next binding** (MIT, 4 hrs)
  - Replace nanostores buffer state
  - CRDT-based undo/redo
- **Task 4.3**: Conflict Resolution UI (8 hrs) — [jsdiff](https://github.com/kpdecker/jsdiff) (BSD-3)
- **Task 4.4**: Background Sync (8 hrs) — [Workbox](https://github.com/GoogleChrome/workbox) (Apache-2.0)

### Sprint 5: Mobile & PWA (Week 6-8)
- **Task 5.1-5.5**: No new OSS, polish existing

### Sprint 6: Extensibility (Week 7-9)
- **Task 6.1**: Plugin Sandbox — custom implementation
- **Task 6.2**: Plugin Marketplace — custom implementation
- **Task 6.3-6.4**: No new OSS

### Sprint 7: Observability (Week 8-10)
- **Task 7.1**: OpenTelemetry — custom implementation
- **Task 7.2**: Sentry — commercial SaaS
- **Task 7.3-7.5**: No new OSS

---

## License Audit Checklist

Before incorporating any OSS project, verify:

- [ ] License is AGPL-3.0 compatible (MIT, Apache-2.0, BSD, ISC, MPL-2.0, GPL-3.0, AGPL-3.0)
- [ ] No SSPL, BUSL, or other non-free licenses
- [ ] No embedded proprietary dependencies
- [ ] Patent grant clause present (Apache-2.0 preferred for this)
- [ ] Copyright notices preserved
- [ ] NOTICE file included if required
- [ ] No telemetry or tracking in the library itself
- [ ] Dependencies of the dependency are also compatible

**Projects to AVOID**:
- Theia core platform: EPL-2.0 (NOT AGPL-3.0 compatible without GPL-2.0 exception)
- Any BUSL/BSL licensed code
- SSPL-licensed software
- Code with "no commercial use" clauses

---

## Dependency Graph

```
DevNoder
├── Editor Layer
│   ├── CodeMirror 6 (MIT) ✅
│   ├── y-codemirror.next (MIT) [PLAN]
│   ├── Monaco Editor (MIT) [OPTION]
│   └── LSP Client (MIT) [PLAN]
│
├── Terminal Layer
│   ├── xterm.js (MIT) ✅
│   ├── @cloudflare/sandbox (Apache-2.0) [PLAN]
│   ├── @xterm/addon-fit (MIT) ✅
│   └── node-pty (MIT) [PLAN]
│
├── Git Layer
│   ├── isomorphic-git (MIT) ✅
│   ├── lightning-fs (MIT) ✅
│   ├── jsdiff (BSD-3) [PLAN]
│   └── VirtualFS (custom) [PLAN]
│
├── AI Layer
│   ├── AIGateway (custom) ✅
│   ├── LiteLLM (MIT) [PLAN]
│   ├── RAGFlow patterns (AGPL-3.0) [PLAN]
│   ├── Aider patterns (Apache-2.0) [PLAN]
│   ├── Continue.dev patterns (Apache-2.0) [PLAN]
│   └── LangGraph (MIT) [OPTION]
│
├── MCP Layer
│   ├── MCPClient (custom) ✅
│   ├── MCP TypeScript SDK (Apache-2.0) [PLAN]
│   ├── MCP Servers (MIT/Apache-2.0) [PLAN]
│   └── Hocuspocus (MIT) [PLAN]
│
├── CRDT Layer
│   ├── Yjs (MIT) ✅
│   ├── y-websocket (MIT) ✅
│   ├── y-indexeddb (MIT) ✅
│   ├── y-codemirror.next (MIT) [PLAN]
│   └── Hocuspocus (MIT) [PLAN]
│
├── PWA Layer
│   ├── vite-plugin-pwa (MIT) ✅
│   ├── Workbox (Apache-2.0) ✅
│   └── [PLAN: enhance]
│
├── Visual Layer
│   ├── GrapesJS (BSD-3) ✅
│   └── CodeSyncEngine (custom) ✅
│
├── Storage Layer
│   ├── Dexie (MIT) ✅
│   ├── IndexedDB (native) ✅
│   └── VirtualFS (custom) [PLAN]
│
└── Cloudflare Layer
    ├── Wrangler (MIT) ✅
    ├── Durable Objects [PLAN]
    ├── D1 [PLAN]
    ├── R2 [PLAN]
    ├── Vectorize [PLAN]
    └── Sandbox SDK (Apache-2.0) [PLAN]
```

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-21 | Adopt Cloudflare Sandbox SDK for terminal | Replaces custom WASM layer, real PTY, Apache-2.0 |
| 2026-09-21 | Adopt y-codemirror.next for collab | Drop-in CRDT binding, MIT, 206 stars |
| 2026-09-21 | Deploy Hocuspocus for collab signaling | Production-ready Yjs server, MIT |
| 2026-09-21 | Evaluate LiteLLM for provider abstraction | 100+ models, MIT, active development |
| 2026-09-21 | Avoid Theia (EPL-2.0) | NOT AGPL-3.0 compatible |
| 2026-09-21 | Evaluate RAGFlow patterns (AGPL-3.0) | Same license, advanced chunking/ranking |

---

## Next Review

- **Date**: 2026-09-28
- **Agenda**: Review OSS audit, prioritize top 3 incorporations, assign owners
- **Inputs Needed**: Team capacity, deployment timeline, feature priority

---

*This document is maintained as part of the DevNoder development plan. Update with each sprint review.*