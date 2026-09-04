import { describe, it, expect, afterEach } from 'vitest';
import { mcpClient } from './MCPClient';
import { mcpConfigStore, MCPServerConfig } from './MCPConfigStore';

describe('mcpClient capability gate', () => {
  const ids: string[] = [];
  const makeConfig = (capabilities: MCPServerConfig['capabilities']): MCPServerConfig => {
    const id = crypto.randomUUID();
    ids.push(id);
    return {
      id, name: 'Zero-Cap Test', icon: '🔌', transport: 'websocket',
      url: 'ws://localhost:1', capabilities, enabled: true, addedAt: Date.now(),
    };
  };

  afterEach(async () => {
    await Promise.all(ids.splice(0).map(id => mcpConfigStore.delete(id).catch(() => {})));
  });

  it('refuses to connect a config with zero granted capabilities', async () => {
    const config = makeConfig([]);
    await expect(mcpClient.connect(config)).rejects.toThrow(/no capabilities granted/);
  });

  it('does not even attempt a transport connection when capabilities are empty', async () => {
    // ws://localhost:1 would otherwise take several seconds to time out
    // (see WebSocketTransport's 6s connect timeout) — the gate must reject
    // synchronously, before any transport is constructed.
    const config = makeConfig([]);
    const start = Date.now();
    await expect(mcpClient.connect(config)).rejects.toThrow();
    expect(Date.now() - start).toBeLessThan(500);
  });

  it('callTool refuses and audit-logs a call to a server that was never connected', async () => {
    const serverId = crypto.randomUUID();
    ids.push(serverId);
    await expect(mcpClient.callTool({ serverId, toolName: 'readFile', args: { path: '/etc/passwd' } }))
      .rejects.toThrow(/not connected/);

    const log = await mcpConfigStore.getAuditLog(serverId);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ toolName: 'readFile', argKeys: ['path'], outcome: 'denied' });
  });
});
