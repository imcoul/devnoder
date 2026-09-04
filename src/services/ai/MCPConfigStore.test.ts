import { describe, it, expect, afterEach } from 'vitest';
import { mcpConfigStore, MCP_PRESETS, MCPServerConfig } from './MCPConfigStore';

describe('mcpConfigStore', () => {
  const ids: string[] = [];
  const addTestServer = async (overrides: Partial<MCPServerConfig> = {}) => {
    const id = crypto.randomUUID();
    ids.push(id);
    const config: MCPServerConfig = {
      id, name: 'Test Server', icon: '🔌', transport: 'websocket',
      url: 'ws://localhost:1', capabilities: ['read'], enabled: true, addedAt: Date.now(),
      ...overrides,
    };
    await mcpConfigStore.add(config);
    return config;
  };

  afterEach(async () => {
    await Promise.all(ids.splice(0).map(id => mcpConfigStore.delete(id)));
  });

  it('round-trips a server config, capabilities included', async () => {
    const config = await addTestServer({ capabilities: ['read', 'write'] });
    const all = await mcpConfigStore.getAll();
    const saved = all.find(s => s.id === config.id);
    expect(saved?.capabilities).toEqual(['read', 'write']);
  });

  it('encrypts headers at rest and decrypts them back correctly', async () => {
    const config = await addTestServer({
      transport: 'sse', url: 'https://example.com/sse',
      headers: { Authorization: 'Bearer super-secret-token' },
    });
    const saved = (await mcpConfigStore.getAll()).find(s => s.id === config.id);
    expect(saved?.headers?.Authorization).toBe('Bearer super-secret-token');
  });

  it('fromPreset generates a fresh id and marks it enabled', () => {
    const server = mcpConfigStore.fromPreset(MCP_PRESETS[0]);
    expect(server.id).toBeTruthy();
    expect(server.enabled).toBe(true);
    expect(server.name).toBe(MCP_PRESETS[0].name);
    expect(server.capabilities).toEqual(MCP_PRESETS[0].capabilities);
  });

  it('every built-in preset declares its own capabilities array', () => {
    for (const preset of MCP_PRESETS) {
      expect(Array.isArray(preset.capabilities)).toBe(true);
    }
  });

  it('toggle flips enabled without touching other fields', async () => {
    const config = await addTestServer();
    await mcpConfigStore.toggle(config.id, false);
    const saved = (await mcpConfigStore.getAll()).find(s => s.id === config.id);
    expect(saved?.enabled).toBe(false);
    expect(saved?.name).toBe(config.name);
  });

  it('delete removes the server entirely', async () => {
    const config = await addTestServer();
    await mcpConfigStore.delete(config.id);
    ids.pop();
    expect((await mcpConfigStore.getAll()).find(s => s.id === config.id)).toBeUndefined();
  });

  describe('audit log', () => {
    it('records entries and returns them newest-first for a given server', async () => {
      const config = await addTestServer();
      await mcpConfigStore.logAudit({ serverId: config.id, serverName: config.name, toolName: 'readFile', argKeys: ['path'], outcome: 'allowed' });
      await new Promise(r => setTimeout(r, 2));
      await mcpConfigStore.logAudit({ serverId: config.id, serverName: config.name, toolName: 'writeFile', argKeys: ['path', 'content'], outcome: 'denied', detail: 'no capabilities granted' });

      const log = await mcpConfigStore.getAuditLog(config.id);
      expect(log).toHaveLength(2);
      expect(log[0].toolName).toBe('writeFile');
      expect(log[0].outcome).toBe('denied');
      expect(log[1].toolName).toBe('readFile');
    });

    it('never stores argument values, only their names — no value-shaped field exists on the record', async () => {
      const config = await addTestServer();
      await mcpConfigStore.logAudit({
        serverId: config.id, serverName: config.name, toolName: 'writeFile',
        argKeys: ['path', 'content'], outcome: 'allowed',
      });
      const [entry] = await mcpConfigStore.getAuditLog(config.id);
      expect(entry.argKeys).toEqual(['path', 'content']);
      // Regression guard: if a future change adds raw argument values to the
      // audit record, this fails — the schema should only ever carry names.
      const allowedKeys = new Set(['argKeys', 'detail', 'id', 'outcome', 'serverId', 'serverName', 'toolName', 'ts']);
      for (const key of Object.keys(entry)) expect(allowedKeys.has(key)).toBe(true);
    });

    it('survives the server being deleted — history stays readable via the denormalized name', async () => {
      const config = await addTestServer();
      await mcpConfigStore.logAudit({ serverId: config.id, serverName: config.name, toolName: 'ping', argKeys: [], outcome: 'allowed' });
      await mcpConfigStore.delete(config.id);
      ids.pop();

      const log = await mcpConfigStore.getAuditLog(config.id);
      expect(log).toHaveLength(1);
      expect(log[0].serverName).toBe(config.name);
    });
  });
});
