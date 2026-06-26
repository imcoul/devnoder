// MCPConfigStore.ts — persist MCP server configs in Dexie
import Dexie, { Table } from 'dexie';

export type MCPTransport = 'stdio' | 'websocket' | 'sse';

export interface MCPServerConfig {
  id: string;
  name: string;
  icon: string;
  transport: MCPTransport;
  command?: string;       // stdio only — e.g. "npx @modelcontextprotocol/server-filesystem /devnoder"
  url?: string;           // websocket / sse — e.g. "ws://localhost:7724" or "https://mcp.notion.com/sse"
  headers?: Record<string, string>;  // for SSE auth (Authorization: Bearer token)
  enabled: boolean;
  addedAt: number;
  lastConnectedAt?: number;
  toolCount?: number;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverId: string;
}

class MCPConfigDB extends Dexie {
  servers!: Table<MCPServerConfig>;
  constructor() {
    super('devnoder-mcp');
    this.version(1).stores({ servers: 'id, transport, enabled, addedAt' });
  }
}

const db = new MCPConfigDB();

// Built-in presets shown in the Add Server UI
export const MCP_PRESETS: Omit<MCPServerConfig, 'id' | 'addedAt' | 'enabled'>[] = [
  {
    name: 'Filesystem (Termux)',
    icon: '📁',
    transport: 'stdio',
    command: 'npx -y @modelcontextprotocol/server-filesystem /devnoder',
  },
  {
    name: 'Git (Termux)',
    icon: '🔀',
    transport: 'stdio',
    command: 'uvx mcp-server-git --repository /devnoder',
  },
  {
    name: 'Fetch / Web',
    icon: '🌐',
    transport: 'stdio',
    command: 'npx -y @modelcontextprotocol/server-fetch',
  },
  {
    name: 'Notion',
    icon: '📝',
    transport: 'sse',
    url: 'https://mcp.notion.com/mcp',
    headers: { Authorization: 'Bearer REPLACE_WITH_NOTION_TOKEN' },
  },
  {
    name: 'GitHub',
    icon: '🐙',
    transport: 'sse',
    url: 'https://api.githubcopilot.com/mcp/',
    headers: { Authorization: 'Bearer REPLACE_WITH_GITHUB_TOKEN' },
  },
  {
    name: 'Custom WebSocket',
    icon: '🔌',
    transport: 'websocket',
    url: 'ws://localhost:7724',
  },
];

export const mcpConfigStore = {
  async getAll(): Promise<MCPServerConfig[]> {
    return db.servers.orderBy('addedAt').toArray();
  },

  async getEnabled(): Promise<MCPServerConfig[]> {
    return db.servers.where('enabled').equals(1).toArray();
  },

  async add(config: Omit<MCPServerConfig, 'addedAt'>): Promise<string> {
    await db.servers.put({ ...config, addedAt: Date.now() });
    return config.id;
  },

  async toggle(id: string, enabled: boolean): Promise<void> {
    await db.servers.update(id, { enabled });
  },

  async updateMeta(id: string, meta: Partial<MCPServerConfig>): Promise<void> {
    await db.servers.update(id, meta);
  },

  async delete(id: string): Promise<void> {
    await db.servers.delete(id);
  },

  fromPreset(preset: typeof MCP_PRESETS[number]): MCPServerConfig {
    return { ...preset, id: crypto.randomUUID(), enabled: true, addedAt: Date.now() };
  },
};
