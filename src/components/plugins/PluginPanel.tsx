// PluginPanel.tsx — thin wrapper; renders the Plugins tab of CommunityPanel
// Registered as its own panel so it can be opened from the command palette
// independently of the full Community panel.
import React, { useState, useEffect } from 'react';
import { pluginAPI, Plugin } from '../../services/plugins/PluginAPI';
import '../community/CommunityPanel.css';

export default function PluginPanel() {
  const [plugins,  setPlugins]  = useState<Plugin[]>([]);
  const [registry, setRegistry] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(false);

  const load = async () => {
    const [inst, reg] = await Promise.all([pluginAPI.getInstalled(), pluginAPI.getRegistry()]);
    setPlugins(inst);
    setRegistry(reg.filter((r: any) => !inst.find(i => i.id === r.id)));
  };

  useEffect(() => { load(); }, []);

  const install = async (id: string) => {
    setLoading(true);
    try { await pluginAPI.install(id); await load(); }
    catch (e: any) { console.error(e); }
    finally { setLoading(false); }
  };

  const toggle = async (id: string, enabled: boolean) => {
    await pluginAPI.toggle(id, enabled); load();
  };

  const uninstall = async (id: string) => {
    await pluginAPI.uninstall(id); load();
  };

  return (
    <div className="community-panel">
      <div style={{ padding:'0.5rem 0.7rem', fontWeight:700, fontSize:'0.9rem',
        background:'var(--color-surface)', borderBlockEnd:'1px solid var(--color-border)' }}>
        🧩 Plugins
      </div>
      <div className="community-body">
        {plugins.length > 0 && (
          <>
            <div className="community-section-head">Installed ({plugins.length})</div>
            {plugins.map(p => (
              <div key={p.id} className="plugin-row">
                <span className="plugin-icon">{p.icon}</span>
                <div className="plugin-info">
                  <div className="plugin-name">{p.name} <span className="plugin-version">v{p.version}</span></div>
                  <div className="plugin-desc">{p.description}</div>
                  <div className="plugin-perms">{p.permissions.join(', ')}</div>
                </div>
                <div className="plugin-actions">
                  <label className="plugin-toggle">
                    <input type="checkbox" checked={p.enabled}
                      onChange={e => toggle(p.id, e.target.checked)} />
                    <span className="toggle-track" />
                  </label>
                  <button className="plugin-remove-btn" onClick={() => uninstall(p.id)}>✕</button>
                </div>
              </div>
            ))}
            <div className="community-divider" />
          </>
        )}
        <div className="community-section-head">Available</div>
        {registry.length === 0 && <p className="community-empty">All registry plugins installed</p>}
        {registry.map((p: any) => (
          <div key={p.id} className="plugin-row">
            <span className="plugin-icon">{p.icon}</span>
            <div className="plugin-info">
              <div className="plugin-name">{p.name}</div>
              <div className="plugin-desc">{p.description}</div>
              <div className="plugin-perms">{p.permissions.join(', ')}</div>
            </div>
            <button className="install-btn" onClick={() => install(p.id)} disabled={loading}>
              Install
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
