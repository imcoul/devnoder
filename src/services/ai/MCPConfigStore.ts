// MCPConfigStore.ts — persist MCP server configs in Dexie
import Dexie, { Table } from 'dexie';
import { cryptoVault } from '../security/CryptoVault';

// Header values (bearer tokens, etc.) are encrypted at rest — only in the
// Dexie record, never in the in-memory MCPServerConfig objects the rest of
// the app (MCPClient.ts) already reads directly as plaintext.
async function encryptHeaders(headers?: Record<string, string>): Promise<Record<string, string> | undefined> {
  if (!headers) return headers;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) out[k] = await cryptoVault.encrypt(v);
  return out;
}

async function decryptHeaders(headers?: Record<string, string>): Promise<Record<string, string> | undefined> {
  if (!headers) return headers;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) out[k] = (await cryptoVault.decrypt(v)) ?? v;
  return out;
}

async function decryptConfig(config: MCPServerConfig): Promise<MCPServerConfig> {
  return { ...config, headers: await decryptHeaders(config.headers) };
}

export type MCPTransport = 'stdio' | 'websocket' | 'sse';

// A connection's declared scope — shown to the user as a consent step before
// it's ever enabled, and enforced (not just cosmetic) in MCPClient: a
// connection with zero granted capabilities can't connect or call tools.
// This is deliberately coarse (whole-connection, not per-tool) because the
// MCP wire protocol carries no standard way to classify what an individual
// tool call actually does — a server can name a tool anything.
export type MCPCapability = 'read' | 'write' | 'execute' | 'network';

export const CAPABILITY_LABELS: Record<MCPCapability, string> = {
  read: 'Read your files or data',
  write: 'Write or modify your files or data',
  execute: 'Run commands or trigger actions',
  network: 'Make network requests on your behalf',
};

export interface MCPServerConfig {
  id: string;
  name: string;
  icon: string;
  transport: MCPTransport;
  command?: string;       // stdio only — e.g. "npx @modelcontextprotocol/server-filesystem /devnoder"
  url?: string;           // websocket / sse — e.g. "ws://localhost:7724" or "https://mcp.notion.com/sse"
  headers?: Record<string, string>;  // for SSE auth (Authorization: Bearer token)
  capabilities: MCPCapability[];  // granted at consent time — see MCPCapability above
  enabled: boolean;
  addedAt: number;
  lastConnectedAt?: number;
  toolCount?: number;
}

export interface MCPAuditEntry {
  id: string;
  ts: number;
  serverId: string;
  serverName: string;  // denormalized so history reads fine after the server is revoked/deleted
  toolName: string;
  argKeys: string[];   // argument names only, never values — this log isn't a secrets store
  outcome: 'allowed' | 'denied' | 'error';
  detail?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverId: string;
}

class MCPConfigDB extends Dexie {
  servers!: Table<MCPServerConfig>;
  auditLog!: Table<MCPAuditEntry>;
  constructor() {
    super('devnoder-mcp');
    this.version(1).stores({ servers: 'id, transport, enabled, addedAt' });
    this.version(2).stores({ servers: 'id, transport, enabled, addedAt', auditLog: 'id, serverId, ts' });
  }
}

const db = new MCPConfigDB();

// Built-in presets shown in the Add Server UI. `capabilities` here is only
// the *suggested* default shown on the consent step — the user can narrow
// or broaden it there before the connection is ever saved or enabled.
export const MCP_PRESETS: Omit<MCPServerConfig, 'id' | 'addedAt' | 'enabled'>[] = [
  {
    name: 'Filesystem (Termux)',
    icon: '📁',
    transport: 'stdio',
    command: 'npx -y @modelcontextprotocol/server-filesystem /devnoder',
    capabilities: ['read', 'write'],
  },
  {
    name: 'Git (Termux)',
    icon: '🔀',
    transport: 'stdio',
    command: 'uvx mcp-server-git --repository /devnoder',
    capabilities: ['read', 'write', 'execute'],
  },
  {
    name: 'Fetch / Web',
    icon: '🌐',
    transport: 'stdio',
    command: 'npx -y @modelcontextprotocol/server-fetch',
    capabilities: ['network'],
  },
  {
    name: 'Notion',
    icon: '📝',
    transport: 'sse',
    url: 'https://mcp.notion.com/mcp',
    headers: { Authorization: 'Bearer REPLACE_WITH_NOTION_TOKEN' },
    capabilities: ['read', 'write'],
  },
  {
    name: 'GitHub',
    icon: '🐙',
    transport: 'sse',
    url: 'https://api.githubcopilot.com/mcp/',
    headers: { Authorization: 'Bearer REPLACE_WITH_GITHUB_TOKEN' },
    capabilities: ['read', 'write', 'execute'],
  },
  {
    name: 'Custom WebSocket',
    icon: '🔌',
    transport: 'websocket',
    url: 'ws://localhost:7724',
    capabilities: [],  // unknown server — force the user to pick explicitly
  },
];

export const mcpConfigStore = {
  async getAll(): Promise<MCPServerConfig[]> {
    const rows = await db.servers.orderBy('addedAt').toArray();
    return Promise.all(rows.map(decryptConfig));
  },

  async getEnabled(): Promise<MCPServerConfig[]> {
    const rows = await db.servers.where('enabled').equals(1).toArray();
    return Promise.all(rows.map(decryptConfig));
  },

  async add(config: Omit<MCPServerConfig, 'addedAt'>): Promise<string> {
    await db.servers.put({ ...config, headers: await encryptHeaders(config.headers), addedAt: Date.now() });
    return config.id;
  },

  async toggle(id: string, enabled: boolean): Promise<void> {
    await db.servers.update(id, { enabled });
  },

  async updateMeta(id: string, meta: Partial<MCPServerConfig>): Promise<void> {
    const patch = meta.headers ? { ...meta, headers: await encryptHeaders(meta.headers) } : meta;
    await db.servers.update(id, patch);
  },

  async delete(id: string): Promise<void> {
    await db.servers.delete(id);
  },

  fromPreset(preset: typeof MCP_PRESETS[number]): MCPServerConfig {
    return { ...preset, id: crypto.randomUUID(), enabled: true, addedAt: Date.now() };
  },

  // ── Audit log — append-only, local only, never synced anywhere ──────────
  async logAudit(entry: Omit<MCPAuditEntry, 'id' | 'ts'>): Promise<void> {
    await db.auditLog.add({ ...entry, id: crypto.randomUUID(), ts: Date.now() });
  },

  async getAuditLog(serverId?: string, limit = 200): Promise<MCPAuditEntry[]> {
    if (serverId) {
      const rows = await db.auditLog.where('serverId').equals(serverId).toArray();
      return rows.sort((a, b) => b.ts - a.ts).slice(0, limit);
    }
    return db.auditLog.orderBy('ts').reverse().limit(limit).toArray();
  },
};
