// PluginAPI.ts — Plugin API Level 1, sandboxed iframe execution
import Dexie, { Table } from 'dexie';

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  icon: string;
  entryUrl: string;       // URL to plugin JS (loaded in sandboxed iframe)
  permissions: PluginPermission[];
  enabled: boolean;
  installedAt: number;
  source: 'registry' | 'local' | 'url';
}

export type PluginPermission =
  | 'read:files'
  | 'write:files'
  | 'read:git'
  | 'ai:complete'
  | 'terminal:run'
  | 'ui:panel'
  | 'storage:read'
  | 'storage:write';

export interface PluginMessage {
  type: string;
  pluginId: string;
  payload: unknown;
  requestId: string;
}

class PluginDB extends Dexie {
  plugins!: Table<Plugin>;
  constructor() {
    super('devnoder-plugins');
    this.version(1).stores({ plugins: 'id, name, enabled, installedAt' });
  }
}

const db = new PluginDB();

// Built-in plugin stubs for discovery
const REGISTRY_PLUGINS: Omit<Plugin, 'enabled' | 'installedAt' | 'source'>[] = [
  {
    id: 'devnoder-prettier',
    name: 'Prettier Format',
    version: '1.0.0',
    description: 'Format code with Prettier on save',
    author: 'Srvel',
    icon: '✨',
    entryUrl: 'https://plugins.devnoder.srvel.io/prettier/index.js',
    permissions: ['read:files', 'write:files'],
  },
  {
    id: 'devnoder-eslint',
    name: 'ESLint Inline',
    version: '1.0.0',
    description: 'Show ESLint errors inline in the editor',
    author: 'Srvel',
    icon: '🔍',
    entryUrl: 'https://plugins.devnoder.srvel.io/eslint/index.js',
    permissions: ['read:files'],
  },
  {
    id: 'devnoder-emmet',
    name: 'Emmet Expand',
    version: '1.0.0',
    description: 'Expand Emmet abbreviations in HTML/CSS',
    author: 'Srvel',
    icon: '⚡',
    entryUrl: 'https://plugins.devnoder.srvel.io/emmet/index.js',
    permissions: ['read:files', 'write:files'],
  },
  {
    id: 'devnoder-todo-tree',
    name: 'TODO Tree',
    version: '1.0.0',
    description: 'Collect and display all TODOs across files',
    author: 'Srvel',
    icon: '📋',
    entryUrl: 'https://plugins.devnoder.srvel.io/todo-tree/index.js',
    permissions: ['read:files', 'ui:panel'],
  },
];

class PluginAPI {
  private sandboxes = new Map<string, HTMLIFrameElement>();
  private pendingRequests = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>();

  async getInstalled(): Promise<Plugin[]> {
    return db.plugins.orderBy('installedAt').reverse().toArray();
  }

  async getRegistry(): Promise<typeof REGISTRY_PLUGINS> {
    return REGISTRY_PLUGINS;
  }

  async install(registryId: string): Promise<Plugin> {
    const def = REGISTRY_PLUGINS.find(p => p.id === registryId);
    if (!def) throw new Error(`Plugin ${registryId} not found in registry`);
    const plugin: Plugin = { ...def, enabled: true, installedAt: Date.now(), source: 'registry' };
    await db.plugins.put(plugin);
    return plugin;
  }

  async installFromUrl(url: string, meta: Pick<Plugin, 'name' | 'description' | 'icon'>): Promise<Plugin> {
    const id = `custom-${Date.now()}`;
    const plugin: Plugin = {
      id, name: meta.name, version: '0.0.1', description: meta.description,
      author: 'Custom', icon: meta.icon, entryUrl: url,
      permissions: ['read:files'], enabled: true,
      installedAt: Date.now(), source: 'url',
    };
    await db.plugins.put(plugin);
    return plugin;
  }

  async uninstall(id: string): Promise<void> {
    this.destroySandbox(id);
    await db.plugins.delete(id);
  }

  async toggle(id: string, enabled: boolean): Promise<void> {
    await db.plugins.update(id, { enabled });
    if (!enabled) this.destroySandbox(id);
  }

  /** Load plugin in sandboxed iframe */
  async activate(plugin: Plugin): Promise<void> {
    if (this.sandboxes.has(plugin.id)) return;
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.sandbox.add('allow-scripts');
    iframe.src = plugin.entryUrl;
    document.body.appendChild(iframe);
    this.sandboxes.set(plugin.id, iframe);

    // Message bridge
    window.addEventListener('message', (e: MessageEvent) => {
      const msg = e.data as PluginMessage;
      if (!msg?.pluginId || msg.pluginId !== plugin.id) return;
      this.handlePluginMessage(plugin, msg);
    });
  }

  private handlePluginMessage(plugin: Plugin, msg: PluginMessage) {
    const perm = (p: PluginPermission) => plugin.permissions.includes(p);
    const pending = this.pendingRequests.get(msg.requestId);

    switch (msg.type) {
      case 'read:files':
        if (!perm('read:files')) { pending?.reject(new Error('Permission denied')); return; }
        // In production: read from lightning-fs
        pending?.resolve({ files: [] });
        break;
      case 'ai:complete':
        if (!perm('ai:complete')) { pending?.reject(new Error('Permission denied')); return; }
        import('../ai/AIGateway').then(({ aiGateway }) =>
          aiGateway.complete(String((msg.payload as any)?.prompt ?? ''))
            .then(r => pending?.resolve(r))
        );
        break;
      default:
        pending?.resolve(null);
    }
  }

  private destroySandbox(id: string) {
    const iframe = this.sandboxes.get(id);
    if (iframe) { iframe.remove(); this.sandboxes.delete(id); }
  }

  async activateAll(): Promise<void> {
    const installed = await this.getInstalled();
    for (const p of installed.filter(p => p.enabled)) {
      await this.activate(p).catch(console.warn);
    }
  }
}

export const pluginAPI = new PluginAPI();
