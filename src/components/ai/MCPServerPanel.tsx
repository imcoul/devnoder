import React, { useState, useEffect, useCallback } from 'react';
import { mcpClient } from '../../services/ai/MCPClient';
import { mcpConfigStore, MCPServerConfig, MCPTool, MCP_PRESETS, MCPTransport } from '../../services/ai/MCPConfigStore';
import { showToast } from '../../stores/ui';
import './MCPServerPanel.css';

type Tab = 'servers' | 'tools' | 'add';

const TRANSPORT_LABELS: Record<MCPTransport, string> = {
  stdio: 'stdio (Termux)',
  websocket: 'WebSocket',
  sse: 'HTTP SSE',
};

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span className={`mcp-status-dot ${connected ? 'mcp-status-dot--on' : 'mcp-status-dot--off'}`}
      title={connected ? 'Connected' : 'Disconnected'} />
  );
}

function ServerRow({ server, connected, onToggle, onDelete, onConnect, onDisconnect }: {
  server: MCPServerConfig;
  connected: boolean;
  onToggle: (id: string, v: boolean) => void;
  onDelete: (id: string) => void;
  onConnect: (server: MCPServerConfig) => void;
  onDisconnect: (id: string) => void;
}) {
  return (
    <div className="mcp-server-row">
      <StatusDot connected={connected} />
      <span className="mcp-server-icon">{server.icon}</span>
      <div className="mcp-server-info">
        <div className="mcp-server-name">{server.name}</div>
        <div className="mcp-server-meta">
          <span className="mcp-transport-badge">{TRANSPORT_LABELS[server.transport]}</span>
          {server.toolCount !== undefined && (
            <span className="mcp-tool-count">{server.toolCount} tools</span>
          )}
          {server.lastConnectedAt && (
            <span className="mcp-last-seen">
              last seen {new Date(server.lastConnectedAt).toLocaleDateString()}
            </span>
          )}
        </div>
        {(server.command || server.url) && (
          <div className="mcp-server-endpoint">
            {server.command ?? server.url}
          </div>
        )}
      </div>
      <div className="mcp-server-actions">
        {connected
          ? <button className="mcp-btn mcp-btn--disconnect" onClick={() => onDisconnect(server.id)}>Disconnect</button>
          : <button className="mcp-btn mcp-btn--connect" onClick={() => onConnect(server)} disabled={!server.enabled}>Connect</button>
        }
        <label className="mcp-toggle" title={server.enabled ? 'Enabled' : 'Disabled'}>
          <input type="checkbox" checked={server.enabled}
            onChange={e => onToggle(server.id, e.target.checked)} />
          <span className="mcp-toggle-track" />
        </label>
        <button className="mcp-del-btn" onClick={() => onDelete(server.id)} aria-label="Delete server">✕</button>
      </div>
    </div>
  );
}

export default function MCPServerPanel() {
  const [tab, setTab]             = useState<Tab>('servers');
  const [servers, setServers]     = useState<MCPServerConfig[]>([]);
  const [tools, setTools]         = useState<MCPTool[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);

  // Add server form
  const [form, setForm] = useState<Partial<MCPServerConfig>>({
    transport: 'stdio', name: '', icon: '🔌', enabled: true,
  });

  const refresh = useCallback(async () => {
    const saved = await mcpConfigStore.getAll();
    setServers(saved);
    setTools(mcpClient.getAllTools());
  }, []);

  useEffect(() => {
    refresh();
    mcpClient.onChange(refresh);
  }, [refresh]);

  const connect = async (server: MCPServerConfig) => {
    setConnecting(server.id);
    try {
      await mcpClient.connect(server);
      showToast({ type: 'success', message: `${server.name} connected — ${mcpClient.getConnection(server.id)?.tools.length ?? 0} tools discovered` });
      refresh();
    } catch (e: any) {
      showToast({ type: 'error', message: `${server.name}: ${e.message}` });
    } finally {
      setConnecting(null);
    }
  };

  const disconnect = async (id: string) => {
    await mcpClient.disconnect(id);
    refresh();
  };

  const toggle = async (id: string, enabled: boolean) => {
    await mcpConfigStore.toggle(id, enabled);
    if (!enabled) await mcpClient.disconnect(id);
    refresh();
  };

  const remove = async (id: string) => {
    await mcpClient.disconnect(id);
    await mcpConfigStore.delete(id);
    refresh();
  };

  const connectAll = async () => {
    showToast({ type: 'info', message: 'Connecting to all enabled servers…' });
    await mcpClient.connectAll();
    refresh();
  };

  const addFromPreset = async (preset: typeof MCP_PRESETS[number]) => {
    const server = mcpConfigStore.fromPreset(preset);
    await mcpConfigStore.add(server);
    setShowPresets(false);
    refresh();
    showToast({ type: 'success', message: `${server.name} added` });
  };

  const addCustom = async () => {
    if (!form.name) { showToast({ type: 'error', message: 'Server name required' }); return; }
    if (form.transport === 'stdio' && !form.command) { showToast({ type: 'error', message: 'Command required for stdio' }); return; }
    if ((form.transport === 'websocket' || form.transport === 'sse') && !form.url) { showToast({ type: 'error', message: 'URL required' }); return; }

    const server: MCPServerConfig = {
      id: crypto.randomUUID(),
      name: form.name!,
      icon: form.icon ?? '🔌',
      transport: form.transport!,
      command: form.command,
      url: form.url,
      enabled: true,
      addedAt: Date.now(),
    };
    await mcpConfigStore.add(server);
    setForm({ transport: 'stdio', name: '', icon: '🔌', enabled: true, command: '', url: '' });
    setTab('servers');
    refresh();
    showToast({ type: 'success', message: `${server.name} added` });
  };

  const connectedIds = new Set(
    mcpClient.getAll().filter(c => c.connected).map(c => c.config.id)
  );

  return (
    <div className="mcp-panel">
      {/* Header */}
      <div className="mcp-header">
        <span className="mcp-title">🔌 MCP Servers</span>
        <div className="mcp-header-actions">
          <span className="mcp-connected-count">
            {connectedIds.size}/{servers.length} connected
          </span>
          <button className="mcp-connect-all-btn" onClick={connectAll}
            disabled={servers.filter(s => s.enabled).length === 0}>
            Connect all
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mcp-tabs">
        {(['servers', 'tools', 'add'] as Tab[]).map(t => (
          <button key={t} className={`mcp-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}>
            {t === 'servers' ? `Servers (${servers.length})`
              : t === 'tools' ? `Tools (${tools.length})`
              : '+ Add'}
          </button>
        ))}
      </div>

      {/* ── Servers tab ── */}
      {tab === 'servers' && (
        <div className="mcp-body">
          {servers.length === 0 && (
            <div className="mcp-empty">
              <span>🔌</span>
              <p>No MCP servers added yet</p>
              <button className="mcp-btn mcp-btn--connect" onClick={() => setTab('add')}>
                Add your first server
              </button>
            </div>
          )}
          {servers.map(server => (
            <ServerRow key={server.id} server={server}
              connected={connectedIds.has(server.id)}
              onToggle={toggle} onDelete={remove}
              onConnect={connect} onDisconnect={disconnect} />
          ))}
        </div>
      )}

      {/* ── Tools tab ── */}
      {tab === 'tools' && (
        <div className="mcp-body">
          {tools.length === 0 && (
            <div className="mcp-empty">
              <span>🛠</span>
              <p>No tools available</p>
              <p className="mcp-empty-sub">Connect a server to discover its tools</p>
            </div>
          )}
          {tools.map((tool, i) => (
            <div key={i} className="mcp-tool-row">
              <div className="mcp-tool-name">{tool.name}</div>
              <div className="mcp-tool-server">
                {servers.find(s => s.id === tool.serverId)?.icon ?? '🔌'}{' '}
                {servers.find(s => s.id === tool.serverId)?.name ?? tool.serverId}
              </div>
              <div className="mcp-tool-desc">{tool.description}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add tab ── */}
      {tab === 'add' && (
        <div className="mcp-body mcp-add-body">
          {/* Presets */}
          <div className="mcp-presets-head">
            <span>Quick add from preset</span>
            <button className="mcp-preset-toggle" onClick={() => setShowPresets(v => !v)}>
              {showPresets ? '▴' : '▾'}
            </button>
          </div>
          {showPresets && (
            <div className="mcp-presets">
              {MCP_PRESETS.map((preset, i) => (
                <button key={i} className="mcp-preset-btn" onClick={() => addFromPreset(preset)}>
                  <span>{preset.icon}</span>
                  <div>
                    <div className="mcp-preset-name">{preset.name}</div>
                    <div className="mcp-preset-transport">{TRANSPORT_LABELS[preset.transport]}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Custom form */}
          <div className="mcp-form-head">Custom server</div>
          <div className="mcp-form">
            <div className="mcp-form-row">
              <input className="mcp-form-icon" value={form.icon ?? ''} maxLength={2}
                onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} />
              <input className="mcp-form-name" placeholder="Server name"
                value={form.name ?? ''}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <select className="mcp-form-select" value={form.transport}
              onChange={e => setForm(f => ({ ...f, transport: e.target.value as MCPTransport }))}>
              {Object.entries(TRANSPORT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {form.transport === 'stdio' && (
              <input className="mcp-form-input" placeholder="Command (e.g. npx @modelcontextprotocol/server-filesystem /devnoder)"
                value={form.command ?? ''}
                onChange={e => setForm(f => ({ ...f, command: e.target.value }))} />
            )}
            {(form.transport === 'websocket' || form.transport === 'sse') && (
              <input className="mcp-form-input" placeholder={form.transport === 'websocket' ? 'ws://localhost:7724' : 'https://mcp.example.com/sse'}
                value={form.url ?? ''}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
            )}
            <button className="mcp-btn mcp-btn--connect" onClick={addCustom}>
              Add Server
            </button>
          </div>

          {/* Termux guide */}
          <div className="mcp-termux-guide">
            <div className="mcp-guide-head">📱 Using Termux (recommended for mobile)</div>
            <ol className="mcp-guide-steps">
              <li>Install Termux from F-Droid</li>
              <li><code>pkg install nodejs python</code></li>
              <li><code>pip install uvx</code></li>
              <li>DevNoder connects via the WS bridge at <code>ws://localhost:7723</code></li>
              <li>Stdio servers spawn as child processes automatically</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
