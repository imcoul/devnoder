// LSPClient.ts — Language Server Protocol client for DevNoder.
//
// Sprint 1.3: LSP Integration.
//   - Communicates with LSP servers via WebSocket (Cloudflare Sandbox) or stdio (local).
//   - Sends JSON-RPC messages and receives diagnostics, completions, etc.
//   - Integrates with CodeMirror for IDE features.

export interface LSPDiagnostic {
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  severity: 1 | 2 | 3 | 4;
  message: string;
  source?: string;
}

export interface LSPClientOptions {
  rootUri?: string;
  languageId?: string;
}

type MessageHandler = (method: string, params: unknown) => void;

export class LSPClient {
  private ws: WebSocket | null = null;
  private rootUri: string;
  private languageId: string;
  private handlers: MessageHandler[] = [];
  private messageId = 0;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (err: Error) => void }>();
  private connected = false;

  constructor(options: LSPClientOptions = {}) {
    this.rootUri = options.rootUri ?? 'file:///projects/default';
    this.languageId = options.languageId ?? 'plaintext';
  }

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        this.ws.onopen = () => {
          this.connected = true;
          this.initialize();
          resolve();
        };
        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            this.handleMessage(msg);
          } catch {
            // Ignore non-JSON messages
          }
        };
        this.ws.onerror = () => reject(new Error('LSP WebSocket connection failed'));
        this.ws.onclose = () => {
          this.connected = false;
        };
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.pending.forEach(({ resolve }) => resolve(undefined));
    this.pending.clear();
  }

  async openDocument(uri: string, content: string) {
    await this.sendNotification('textDocument/didOpen', {
      textDocument: { uri, languageId: this.languageId, version: 1, text: content },
    });
  }

  async updateDocument(uri: string, content: string, version = 1) {
    await this.sendNotification('textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges: [{ text: content }],
    });
  }

  async getDiagnostics(uri: string): Promise<LSPDiagnostic[]> {
    // Diagnostics are pushed by the server via textDocument/publishDiagnostics
    // This method returns a promise that resolves when diagnostics are received
    return new Promise((resolve) => {
      const handler: MessageHandler = (method, params) => {
        if (method === 'textDocument/publishDiagnostics') {
          const diag = params as { uri: string; diagnostics: LSPDiagnostic[] };
          if (diag.uri === uri) {
            this.handlers = this.handlers.filter(h => h !== handler);
            resolve(diag.diagnostics);
          }
        }
      };
      this.handlers.push(handler);
      // Timeout after 5s
      setTimeout(() => {
        this.handlers = this.handlers.filter(h => h !== handler);
        resolve([]);
      }, 5000);
    });
  }

  async getCompletions(uri: string, line: number, character: number) {
    return this.sendRequest('textDocument/completion', {
      textDocument: { uri },
      position: { line, character },
    });
  }

  onDiagnostic(handler: (uri: string, diagnostics: LSPDiagnostic[]) => void) {
    const h: MessageHandler = (method, params) => {
      if (method === 'textDocument/publishDiagnostics') {
        const diag = params as { uri: string; diagnostics: LSPDiagnostic[] };
        handler(diag.uri, diag.diagnostics);
      }
    };
    this.handlers.push(h);
    return () => {
      this.handlers = this.handlers.filter(h => h !== h);
    };
  }

  isConnected() {
    return this.connected;
  }

  private async initialize() {
    await this.sendRequest('initialize', {
      processId: null,
      rootUri: this.rootUri,
      capabilities: {},
    });
    await this.sendNotification('initialized', {});
  }

  private sendRequest(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== 1) {
        reject(new Error('LSP client not connected'));
        return;
      }
      const id = ++this.messageId;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  }

  private sendNotification(method: string, params: unknown) {
    if (!this.ws || this.ws.readyState !== 1) return;
    this.ws.send(JSON.stringify({ jsonrpc: '2.0', method, params }));
  }

  private handleMessage(msg: { id?: number; method?: string; params?: unknown; result?: unknown }) {
    if (msg.id && this.pending.has(msg.id)) {
      const { resolve } = this.pending.get(msg.id)!;
      this.pending.delete(msg.id);
      resolve(msg.result);
    } else if (msg.method) {
      this.handlers.forEach(h => h(msg.method, msg.params));
    }
  }
}

export function createLSPClient(options?: LSPClientOptions) {
  return new LSPClient(options);
}
