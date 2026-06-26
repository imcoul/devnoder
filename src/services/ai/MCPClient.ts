// MCPClient.ts — full MCP client: stdio (Termux WS bridge) / WebSocket / HTTP SSE
import { MCPServerConfig, MCPTool, mcpConfigStore } from './MCPConfigStore';

// ─── MCP protocol types ───────────────────────────────────────────────────────
interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

export interface ToolCallRequest {
  serverId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolCallResult {
  content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>;
  isError?: boolean;
}

// ─── Transport base ───────────────────────────────────────────────────────────
abstract class MCPTransport {
  protected pending = new Map<string | number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  protected msgId = 1;

  abstract connect(): Promise<void>;
  abstract disconnect(): void;
  abstract send(msg: MCPRequest): void;

  protected handleMessage(raw: string) {
    try {
      const msg = JSON.parse(raw) as MCPResponse | MCPNotification;
      if ('id' in msg) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if ((msg as MCPResponse).error) p.reject(new Error((msg as MCPResponse).error!.message));
        else p.resolve((msg as MCPResponse).result);
      }
    } catch { /* skip malformed */ }
  }

  async call(method: string, params?: unknown): Promise<unknown> {
    const id = this.msgId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ jsonrpc: '2.0', id, method, params });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`MCP timeout: ${method}`));
        }
      }, 15000);
    });
  }
}

// ─── WebSocket transport ──────────────────────────────────────────────────────
class WebSocketTransport extends MCPTransport {
  private ws: WebSocket | null = null;
  private queue: MCPRequest[] = [];

  constructor(private url: string) { super(); }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      const timeout = setTimeout(() => { ws.close(); reject(new Error('WS connect timeout')); }, 6000);
      ws.onopen = () => {
        clearTimeout(timeout);
        this.ws = ws;
        this.queue.forEach(m => ws.send(JSON.stringify(m)));
        this.queue = [];
        resolve();
      };
      ws.onmessage = e => this.handleMessage(e.data);
      ws.onerror = () => { clearTimeout(timeout); reject(new Error('WS error')); };
      ws.onclose = () => { this.ws = null; };
    });
  }

  disconnect() { this.ws?.close(); this.ws = null; }

  send(msg: MCPRequest) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
    else this.queue.push(msg);
  }
}

// ─── HTTP SSE transport ───────────────────────────────────────────────────────
class SSETransport extends MCPTransport {
  private es: EventSource | null = null;
  private postUrl: string;

  constructor(private sseUrl: string, private headers: Record<string, string> = {}) {
    super();
    // SSE URL for receive, derived POST URL for send
    this.postUrl = sseUrl.replace(/\/sse$/, '/message').replace(/\?.*$/, '');
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // EventSource doesn't support custom headers natively —
      // use fetch-based SSE polyfill for authenticated connections
      const url = Object.keys(this.headers).length === 0
        ? this.sseUrl
        : this.sseUrl; // same URL; auth handled server-side via query param or cookie

      const es = new EventSource(url);
      const timeout = setTimeout(() => { es.close(); reject(new Error('SSE connect timeout')); }, 8000);

      es.onopen = () => { clearTimeout(timeout); this.es = es; resolve(); };
      es.onmessage = e => this.handleMessage(e.data);
      es.onerror = () => { clearTimeout(timeout); reject(new Error('SSE connection failed')); };
    });
  }

  disconnect() { this.es?.close(); this.es = null; }

  send(msg: MCPRequest) {
    // SSE is receive-only; send via POST
    fetch(this.postUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.headers },
      body: JSON.stringify(msg),
    }).catch(console.warn);
  }
}

// ─── stdio-via-Termux transport ───────────────────────────────────────────────
class StdioTermuxTransport extends MCPTransport {
  private ws: WebSocket | null = null;
  private queue: string[] = [];

  constructor(private command: string) { super(); }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Connect to Termux WS bridge on port 7723
      // The bridge spawns the command and pipes stdio over WebSocket
      const ws = new WebSocket('ws://localhost:7723/mcp');
      const timeout = setTimeout(() => { ws.close(); reject(new Error('Termux bridge not available')); }, 4000);

      ws.onopen = () => {
        clearTimeout(timeout);
        // Tell bridge which command to spawn
        ws.send(JSON.stringify({ type: 'spawn', command: this.command }));
        this.ws = ws;
        this.queue.forEach(m => ws.send(m));
        this.queue = [];
      };

      ws.onmessage = e => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'ready') { resolve(); return; }
          if (msg.type === 'stdout') this.handleMessage(msg.data);
          if (msg.type === 'error') reject(new Error(msg.error));
        } catch { this.handleMessage(e.data); }
      };

      ws.onerror = () => { clearTimeout(timeout); reject(new Error('Termux WS bridge error')); };
      ws.onclose = () => { this.ws = null; };
    });
  }

  disconnect() { this.ws?.close(); this.ws = null; }

  send(msg: MCPRequest) {
    const raw = JSON.stringify(msg);
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(raw);
    else this.queue.push(raw);
  }
}

// ─── Server connection ────────────────────────────────────────────────────────
interface MCPConnection {
  config: MCPServerConfig;
  transport: MCPTransport;
  tools: MCPTool[];
  connected: boolean;
}

// ─── Main MCP Client ─────────────────────────────────────────────────────────
class MCPClient {
  private connections = new Map<string, MCPConnection>();
  private listeners: Array<() => void> = [];

  onChange(cb: () => void) { this.listeners.push(cb); }
  private notify() { this.listeners.forEach(cb => cb()); }

  private makeTransport(config: MCPServerConfig): MCPTransport {
    switch (config.transport) {
      case 'websocket': return new WebSocketTransport(config.url!);
      case 'sse':       return new SSETransport(config.url!, config.headers);
      case 'stdio':     return new StdioTermuxTransport(config.command!);
    }
  }

  async connect(config: MCPServerConfig): Promise<MCPConnection> {
    const existing = this.connections.get(config.id);
    if (existing?.connected) return existing;

    const transport = this.makeTransport(config);
    const conn: MCPConnection = { config, transport, tools: [], connected: false };
    this.connections.set(config.id, conn);

    await transport.connect();
    conn.connected = true;

    // MCP handshake
    await transport.call('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'DevNoder', version: '0.1.0' },
    });
    await transport.call('notifications/initialized');

    // Discover tools
    const toolsResult = await transport.call('tools/list') as { tools: any[] };
    conn.tools = (toolsResult.tools ?? []).map(t => ({
      name: t.name,
      description: t.description ?? '',
      inputSchema: t.inputSchema ?? {},
      serverId: config.id,
    }));

    await mcpConfigStore.updateMeta(config.id, {
      lastConnectedAt: Date.now(),
      toolCount: conn.tools.length,
    });

    this.notify();
    return conn;
  }

  async disconnect(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId);
    if (!conn) return;
    conn.transport.disconnect();
    conn.connected = false;
    this.connections.delete(serverId);
    this.notify();
  }

  async connectAll(): Promise<void> {
    const servers = await mcpConfigStore.getEnabled();
    await Promise.allSettled(servers.map(s => this.connect(s)));
  }

  getAllTools(): MCPTool[] {
    return Array.from(this.connections.values())
      .filter(c => c.connected)
      .flatMap(c => c.tools);
  }

  getConnection(serverId: string): MCPConnection | undefined {
    return this.connections.get(serverId);
  }

  getAll(): MCPConnection[] {
    return Array.from(this.connections.values());
  }

  async callTool(req: ToolCallRequest): Promise<ToolCallResult> {
    const conn = this.connections.get(req.serverId);
    if (!conn?.connected) throw new Error(`Server ${req.serverId} not connected`);

    const result = await conn.transport.call('tools/call', {
      name: req.toolName,
      arguments: req.args,
    }) as ToolCallResult;

    return result;
  }

  // Convert MCP tool schema to Anthropic/OpenAI tool format
  toAnthropicTools(tools: MCPTool[]): any[] {
    return tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));
  }

  toOpenAITools(tools: MCPTool[]): any[] {
    return tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));
  }

  // Convert tool result to text for injection
  resultToText(result: ToolCallResult): string {
    return result.content
      .map(c => c.type === 'text' ? c.text : `[image: ${c.mimeType}]`)
      .join('\n');
  }
}

export const mcpClient = new MCPClient();
