// MCPClient.ts — full MCP client using @modelcontextprotocol/sdk (Apache-2.0).
//
// Sprint 2 Task 2.1: Adopt MCP TypeScript SDK.
//   - Replaces custom transport implementations with SDK's Client + transports.
//   - Maintains backward-compatible API for existing consumers.

import { MCPServerConfig, MCPTool, mcpConfigStore } from './MCPConfigStore';
import { WASITransport } from './MCPWASITransport';

export interface ToolCallRequest {
  serverId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolCallResult {
  content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>;
  isError?: boolean;
}

interface MCPConnection {
  config: MCPServerConfig;
  client: any;
  tools: MCPTool[];
  connected: boolean;
}

class MCPClient {
  private connections = new Map<string, MCPConnection>();
  private listeners: Array<() => void> = [];

  onChange(cb: () => void) { this.listeners.push(cb); }
  private notify() { this.listeners.forEach(cb => cb()); }

  private async loadSDK(): Promise<{
    Client: new (info: { name: string; version: string }, options?: any) => any;
    WebSocketClientTransport: new (url: URL) => any;
  }> {
    const sdk = await import('@modelcontextprotocol/sdk/client/index.js');
    const wsTransport = await import('@modelcontextprotocol/sdk/client/websocket.js');
    return {
      Client: sdk.Client as any,
      WebSocketClientTransport: wsTransport.WebSocketClientTransport as any,
    };
  }

  private async makeTransport(config: MCPServerConfig, sdk: Awaited<ReturnType<typeof this.loadSDK>>): Promise<any> {
    if (config.transport === 'websocket') {
      return new sdk.WebSocketClientTransport(new URL(config.url!));
    }
    if (config.transport === 'stdio') {
      return new WASITransport(config.command!);
    }
    throw new Error(`Unsupported transport: ${(config as any).transport}`);
  }

  async connect(config: MCPServerConfig): Promise<MCPConnection> {
    const existing = this.connections.get(config.id);
    if (existing?.connected) return existing;

    if (!config.capabilities?.length) {
      throw new Error(`${config.name}: no capabilities granted — nothing to connect for`);
    }

    const sdk = await this.loadSDK();
    const transport = await this.makeTransport(config, sdk);
    const client = new sdk.Client(
      { name: 'DevNoder', version: '0.1.0' },
      { capabilities: { sampling: { tools: {} } } },
    );

    const conn: MCPConnection = { config, client, tools: [], connected: false };
    this.connections.set(config.id, conn);

    try {
      await client.connect(transport);
      conn.connected = true;

      const toolsResult = await client.listTools({}, { timeout: 10000 });
      conn.tools = (toolsResult.tools ?? []).map((t: any) => ({
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
    } catch (e) {
      conn.connected = false;
      this.connections.delete(config.id);
      throw e;
    }
  }

  async disconnect(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId);
    if (!conn) return;
    try {
      await conn.client.close();
    } catch {
      // Ignore close errors
    }
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
    const argKeys = Object.keys(req.args ?? {});

    if (!conn?.connected) {
      await mcpConfigStore.logAudit({
        serverId: req.serverId, serverName: conn?.config.name ?? req.serverId,
        toolName: req.toolName, argKeys, outcome: 'denied', detail: 'not connected',
      });
      throw new Error(`Server ${req.serverId} not connected`);
    }
    if (!conn.config.capabilities?.length) {
      await mcpConfigStore.logAudit({
        serverId: req.serverId, serverName: conn.config.name,
        toolName: req.toolName, argKeys, outcome: 'denied', detail: 'no capabilities granted',
      });
      throw new Error(`${conn.config.name}: no capabilities granted — refusing tool call`);
    }

    try {
      const result = await conn.client.callTool(
        { name: req.toolName, arguments: req.args },
        undefined,
        { timeout: 30000 },
      );
      const content = (result as any).content ?? [];
      await mcpConfigStore.logAudit({
        serverId: req.serverId, serverName: conn.config.name,
        toolName: req.toolName, argKeys, outcome: 'allowed',
      });
      return { content };
    } catch (e: any) {
      await mcpConfigStore.logAudit({
        serverId: req.serverId, serverName: conn.config.name,
        toolName: req.toolName, argKeys, outcome: 'error', detail: e.message,
      });
      throw e;
    }
  }

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

  resultToText(result: ToolCallResult): string {
    return result.content
      .map(c => c.type === 'text' ? c.text : `[image: ${c.mimeType}]`)
      .join('\n');
  }
}

export const mcpClient = new MCPClient();
