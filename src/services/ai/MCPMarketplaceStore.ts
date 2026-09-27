// MCPMarketplaceStore.ts — curated catalog of community MCP servers.
import type { MCPTransport, MCPCapability, MCPServerConfig } from './MCPConfigStore';

export interface MarketplaceEntry {
  id: string;
  name: string;
  description: string;
  icon: string;
  transport: MCPTransport;
  command?: string;
  url?: string;
  capabilities: MCPCapability[];
  author: string;
  tags: string[];
}

const CATALOG: MarketplaceEntry[] = [
  { id: 'filesystem', name: 'Filesystem', description: 'Read and write local files with path sandboxing.', icon: '📁', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-filesystem /devnoder', capabilities: ['read', 'write'], author: 'Anthropic', tags: ['files', 'local'] },
  { id: 'git', name: 'Git', description: 'Inspect repos, read logs, diff commits.', icon: '🔀', transport: 'stdio', command: 'uvx mcp-server-git --repository /devnoder', capabilities: ['read', 'write', 'execute'], author: 'Anthropic', tags: ['git', 'vcs'] },
  { id: 'fetch', name: 'Fetch', description: 'Fetch web pages and convert to markdown.', icon: '🌐', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-fetch', capabilities: ['network'], author: 'Anthropic', tags: ['web', 'http'] },
  { id: 'notion', name: 'Notion', description: 'Search and edit Notion databases and pages.', icon: '📝', transport: 'sse', url: 'https://mcp.notion.com/mcp', capabilities: ['read', 'write'], author: 'Notion', tags: ['productivity', 'notes'] },
  { id: 'github', name: 'GitHub', description: 'Issues, PRs, repos, and GitHub Actions.', icon: '🐙', transport: 'sse', url: 'https://api.githubcopilot.com/mcp/', capabilities: ['read', 'write', 'execute'], author: 'GitHub', tags: ['git', 'ci'] },
  { id: 'sqlite', name: 'SQLite', description: 'Query local SQLite databases.', icon: '🗄', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-sqlite', capabilities: ['read', 'write'], author: 'Anthropic', tags: ['database', 'sql'] },
  { id: 'puppeteer', name: 'Puppeteer', description: 'Browser automation and screenshots.', icon: '🖥', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-puppeteer', capabilities: ['network', 'execute'], author: 'Anthropic', tags: ['browser', 'automation'] },
  { id: 'brave-search', name: 'Brave Search', description: 'Web search via Brave Search API.', icon: '🔎', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-brave-search', capabilities: ['network'], author: 'Brave', tags: ['web', 'search'] },
  { id: 'postgres', name: 'PostgreSQL', description: 'Query PostgreSQL databases.', icon: '🐘', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-postgres', capabilities: ['read', 'write'], author: 'Community', tags: ['database', 'sql'] },
  { id: 'redis', name: 'Redis', description: 'Inspect and modify Redis keys.', icon: '🔴', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-redis', capabilities: ['read', 'write'], author: 'Community', tags: ['database', 'cache'] },
  { id: 'docker', name: 'Docker', description: 'Manage containers and images.', icon: '🐳', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-docker', capabilities: ['execute', 'network'], author: 'Community', tags: ['devops', 'containers'] },
  { id: 'kubernetes', name: 'Kubernetes', description: 'Inspect pods, services, and deployments.', icon: '☸', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-kubernetes', capabilities: ['read', 'execute'], author: 'Community', tags: ['devops', 'k8s'] },
  { id: 'aws', name: 'AWS', description: 'Manage AWS resources via boto3.', icon: '☁', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-aws', capabilities: ['read', 'write', 'execute', 'network'], author: 'Community', tags: ['cloud', 'aws'] },
  { id: 'gcal', name: 'Google Calendar', description: 'Read and create calendar events.', icon: '📅', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-google-calendar', capabilities: ['read', 'write'], author: 'Community', tags: ['productivity', 'calendar'] },
  { id: 'gmail', name: 'Gmail', description: 'Search and send emails.', icon: '📧', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-gmail', capabilities: ['read', 'write'], author: 'Community', tags: ['productivity', 'email'] },
  { id: 'slack', name: 'Slack', description: 'Read channels and send messages.', icon: '💬', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-slack', capabilities: ['read', 'write'], author: 'Community', tags: ['chat', 'productivity'] },
  { id: 'obsidian', name: 'Obsidian', description: 'Search and edit Obsidian vault notes.', icon: '💎', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-obsidian', capabilities: ['read', 'write'], author: 'Community', tags: ['notes', 'local'] },
  { id: 'linear', name: 'Linear', description: 'Manage issues and projects.', icon: '📐', transport: 'sse', url: 'https://mcp.linear.app/mcp', capabilities: ['read', 'write'], author: 'Linear', tags: ['productivity', 'issues'] },
  { id: 'stripe', name: 'Stripe', description: 'Inspect charges, customers, and subscriptions.', icon: '💳', transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-stripe', capabilities: ['read'], author: 'Community', tags: ['payments', 'finance'] },
];

export const marketplaceStore = {
  async search(query = '', tags?: string[]): Promise<MarketplaceEntry[]> {
    const q = query.toLowerCase().trim();
    return CATALOG.filter(entry => {
      const matchesQuery = !q || entry.name.toLowerCase().includes(q) || entry.description.toLowerCase().includes(q) || entry.tags.some(t => t.includes(q));
      const matchesTags = !tags?.length || tags.every(t => entry.tags.includes(t));
      return matchesQuery && matchesTags;
    });
  },

  async getById(id: string): Promise<MarketplaceEntry | undefined> {
    return CATALOG.find(e => e.id === id);
  },

  async getByTag(tag: string): Promise<MarketplaceEntry[]> {
    return CATALOG.filter(e => e.tags.includes(tag));
  },

  async tags(): Promise<string[]> {
    const set = new Set<string>();
    for (const e of CATALOG) for (const t of e.tags) set.add(t);
    return Array.from(set).sort();
  },

  toDraft(entry: MarketplaceEntry): Omit<MCPServerConfig, 'id' | 'addedAt' | 'enabled'> {
    return {
      name: entry.name,
      icon: entry.icon,
      transport: entry.transport,
      command: entry.command,
      url: entry.url,
      capabilities: [...entry.capabilities],
    };
  },
};
