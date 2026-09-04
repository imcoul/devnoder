import React, { useState, useEffect, useCallback } from 'react';
import { mcpClient } from '../../services/ai/MCPClient';
import {
  mcpConfigStore, MCPServerConfig, MCPTool, MCP_PRESETS, MCPTransport,
  MCPCapability, CAPABILITY_LABELS, MCPAuditEntry,
} from '../../services/ai/MCPConfigStore';
import { connectionSigning } from '../../services/security/ConnectionSigning';
import { showToast } from '../../stores/ui';
import './MCPServerPanel.css';

type Tab = 'servers' | 'tools' | 'add' | 'audit';
type Draft = Omit<MCPServerConfig, 'id' | 'addedAt' | 'enabled'>;

const TRANSPORT_LABELS: Record<MCPTransport, string> = {
  stdio: 'stdio (Termux)',
  websocket: 'WebSocket',
  sse: 'HTTP SSE',
};

const ALL_CAPABILITIES = Object.keys(CAPABILITY_LABELS) as MCPCapability[];

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span className={`mcp-status-dot ${connected ? 'mcp-status-dot--on' : 'mcp-status-dot--off'}`}
      title={connected ? 'Connected' : 'Disconnected'} />
  );
}

function IdentityBlock({ serverId }: { serverId: string }) {
  const [publicJwk, setPublicJwk] = useState<JsonWebKey | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    setPublicJwk((await connectionSigning.getPublicKey(serverId)) ?? null);
  }, [serverId]);

  useEffect(() => { refresh(); }, [refresh]);

  const generate = async () => {
    const jwk = await connectionSigning.generateIdentity(serverId);
    setPublicJwk(jwk);
    showToast({ type: 'success', message: 'Connection identity generated — share the public key with the counterparty to register it' });
  };

  const revoke = async () => {
    await connectionSigning.revokeIdentity(serverId);
    setPublicJwk(null);
    showToast({ type: 'info', message: 'Connection identity revoked' });
  };

  const copyKey = async () => {
    await navigator.clipboard.writeText(JSON.stringify(publicJwk));
    showToast({ type: 'success', message: 'Public key copied' });
  };

  return (
    <div className="mcp-identity-block">
      <div className="mcp-identity-desc">
        Connection identity — a keypair this connection can sign requests with.
        Not yet verified by any external server; groundwork for a future
        signed-connection counterparty (Phase 10).
      </div>
      {publicJwk
        ? (
          <div className="mcp-identity-actions">
            <span className="mcp-identity-status">🔑 Identity generated</span>
            <button className="mcp-btn" onClick={copyKey}>Copy public key</button>
            <button className="mcp-btn mcp-btn--disconnect" onClick={revoke}>Revoke identity</button>
          </div>
        )
        : (
          <button className="mcp-btn mcp-btn--connect" onClick={generate}>Generate identity</button>
        )}
    </div>
  );
}

function ServerRow({ server, connected, expanded, onToggle, onRevoke, onConnect, onDisconnect, onExpand }: {
  server: MCPServerConfig;
  connected: boolean;
  expanded: boolean;
  onToggle: (id: string, v: boolean) => void;
  onRevoke: (server: MCPServerConfig) => void;
  onConnect: (server: MCPServerConfig) => void;
  onDisconnect: (id: string) => void;
  onExpand: (id: string) => void;
}) {
  return (
    <div className="mcp-server-row-wrap">
      <div className="mcp-server-row">
        <StatusDot connected={connected} />
        <span className="mcp-server-icon">{server.icon}</span>
        <div className="mcp-server-info">
          <div className="mcp-server-name">{server.name}</div>
          <div className="mcp-server-meta">
            <span className="mcp-transport-badge">{TRANSPORT_LABELS[server.transport]}</span>
            {server.capabilities.map(c => (
              <span key={c} className="mcp-capability-badge" title={CAPABILITY_LABELS[c]}>{c}</span>
            ))}
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
            <input type="checkbox" checked={server.enabled} aria-label={`${server.enabled ? 'Disable' : 'Enable'} ${server.name}`}
              onChange={e => onToggle(server.id, e.target.checked)} />
            <span className="mcp-toggle-track" />
          </label>
          <button className="mcp-detail-btn" onClick={() => onExpand(server.id)} aria-expanded={expanded}
            aria-label={`${expanded ? 'Hide' : 'Show'} ${server.name} connection identity`}>🔑</button>
          <button className="mcp-del-btn" onClick={() => onRevoke(server)}
            aria-label={`Revoke ${server.name} — permanently deletes its stored credentials`}
            title="Revoke — permanently deletes stored credentials">✕</button>
        </div>
      </div>
      {expanded && <IdentityBlock serverId={server.id} />}
    </div>
  );
}

function ConsentStep({ draft, onConfirm, onCancel }: {
  draft: Draft;
  onConfirm: (capabilities: MCPCapability[]) => void;
  onCancel: () => void;
}) {
  const [granted, setGranted] = useState<Set<MCPCapability>>(new Set(draft.capabilities));

  const flip = (cap: MCPCapability) => {
    setGranted(prev => {
      const next = new Set(prev);
      if (next.has(cap)) next.delete(cap); else next.add(cap);
      return next;
    });
  };

  return (
    <div className="mcp-consent-overlay" onClick={onCancel}>
      <div className="mcp-consent-modal" onClick={e => e.stopPropagation()}>
        <div className="mcp-consent-head">
          <span>{draft.icon}</span>
          <div>
            <div className="mcp-consent-name">{draft.name}</div>
            <div className="mcp-consent-sub">wants the following access</div>
          </div>
        </div>
        <div className="mcp-consent-caps">
          {ALL_CAPABILITIES.map(cap => (
            <label key={cap} className="mcp-consent-cap">
              <input type="checkbox" checked={granted.has(cap)} onChange={() => flip(cap)} />
              <span>{CAPABILITY_LABELS[cap]}</span>
            </label>
          ))}
        </div>
        {granted.size === 0 && (
          <p className="mcp-consent-warning">Grant at least one capability, or this connection won't be able to do anything.</p>
        )}
        <div className="mcp-consent-actions">
          <button className="mcp-btn" onClick={onCancel}>Cancel</button>
          <button className="mcp-btn mcp-btn--connect" disabled={granted.size === 0}
            onClick={() => onConfirm(Array.from(granted))}>
            Grant & add
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MCPServerPanel() {
  const [tab, setTab]             = useState<Tab>('servers');
  const [servers, setServers]     = useState<MCPServerConfig[]>([]);
  const [tools, setTools]         = useState<MCPTool[]>([]);
  const [auditLog, setAuditLog]   = useState<MCPAuditEntry[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [consentDraft, setConsentDraft] = useState<Draft | null>(null);

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

  useEffect(() => {
    if (tab === 'audit') mcpConfigStore.getAuditLog().then(setAuditLog);
  }, [tab, servers]);

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

  const revoke = async (server: MCPServerConfig) => {
    await mcpClient.disconnect(server.id);
    await mcpConfigStore.delete(server.id);
    await connectionSigning.revokeIdentity(server.id);
    refresh();
    showToast({ type: 'info', message: `${server.name} revoked — stored credentials deleted` });
  };

  const connectAll = async () => {
    showToast({ type: 'info', message: 'Connecting to all enabled servers…' });
    await mcpClient.connectAll();
    refresh();
  };

  const confirmConsent = async (capabilities: MCPCapability[]) => {
    if (!consentDraft) return;
    const server = mcpConfigStore.fromPreset({ ...consentDraft, capabilities });
    await mcpConfigStore.add(server);
    setConsentDraft(null);
    setShowPresets(false);
    setTab('servers');
    refresh();
    showToast({ type: 'success', message: `${server.name} added` });
  };

  const addFromPreset = (preset: typeof MCP_PRESETS[number]) => setConsentDraft(preset);

  const addCustom = () => {
    if (!form.name) { showToast({ type: 'error', message: 'Server name required' }); return; }
    if (form.transport === 'stdio' && !form.command) { showToast({ type: 'error', message: 'Command required for stdio' }); return; }
    if ((form.transport === 'websocket' || form.transport === 'sse') && !form.url) { showToast({ type: 'error', message: 'URL required' }); return; }

    setConsentDraft({
      name: form.name!,
      icon: form.icon ?? '🔌',
      transport: form.transport!,
      command: form.command,
      url: form.url,
      capabilities: [],
    });
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
      <div className="mcp-tabs" role="tablist">
        {(['servers', 'tools', 'add', 'audit'] as Tab[]).map(t => (
          <button key={t} className={`mcp-tab ${tab === t ? 'active' : ''}`}
            role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t === 'servers' ? `Servers (${servers.length})`
              : t === 'tools' ? `Tools (${tools.length})`
              : t === 'audit' ? 'Audit log'
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
              expanded={expandedId === server.id}
              onToggle={toggle} onRevoke={revoke}
              onConnect={connect} onDisconnect={disconnect}
              onExpand={id => setExpandedId(prev => prev === id ? null : id)} />
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

      {/* ── Audit log tab ── */}
      {tab === 'audit' && (
        <div className="mcp-body">
          {auditLog.length === 0 && (
            <div className="mcp-empty">
              <span>📜</span>
              <p>No activity recorded yet</p>
              <p className="mcp-empty-sub">Every tool call through an MCP connection is logged here, locally only</p>
            </div>
          )}
          {auditLog.map(entry => (
            <div key={entry.id} className={`mcp-audit-row mcp-audit-row--${entry.outcome}`}>
              <span className={`mcp-audit-badge mcp-audit-badge--${entry.outcome}`}>{entry.outcome}</span>
              <div className="mcp-audit-info">
                <div className="mcp-audit-tool">{entry.serverName} → {entry.toolName}</div>
                <div className="mcp-audit-meta">
                  {new Date(entry.ts).toLocaleString()}
                  {entry.argKeys.length > 0 && ` · args: ${entry.argKeys.join(', ')}`}
                  {entry.detail && ` · ${entry.detail}`}
                </div>
              </div>
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
              <input className="mcp-form-icon" value={form.icon ?? ''} maxLength={2} aria-label="Server icon"
                onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} />
              <input className="mcp-form-name" placeholder="Server name" aria-label="Server name"
                value={form.name ?? ''}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <select className="mcp-form-select" aria-label="Transport" value={form.transport}
              onChange={e => setForm(f => ({ ...f, transport: e.target.value as MCPTransport }))}>
              {Object.entries(TRANSPORT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {form.transport === 'stdio' && (
              <input className="mcp-form-input" placeholder="Command (e.g. npx @modelcontextprotocol/server-filesystem /devnoder)"
                aria-label="Command" value={form.command ?? ''}
                onChange={e => setForm(f => ({ ...f, command: e.target.value }))} />
            )}
            {(form.transport === 'websocket' || form.transport === 'sse') && (
              <input className="mcp-form-input" placeholder={form.transport === 'websocket' ? 'ws://localhost:7724' : 'https://mcp.example.com/sse'}
                aria-label="Server URL" value={form.url ?? ''}
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

      {consentDraft && (
        <ConsentStep draft={consentDraft} onConfirm={confirmConsent} onCancel={() => setConsentDraft(null)} />
      )}
    </div>
  );
}
