import React, { useState, useEffect } from 'react';
import { pluginAPI, Plugin } from '../../services/plugins/PluginAPI';
import { themeRegistry, CommunityTheme } from '../../services/community/ThemeRegistry';
import { computePool } from '../../services/community/ComputePool';
import { AppIcon } from '../brand/AppIcon';
import './CommunityPanel.css';

type Tab = 'plugins' | 'themes' | 'compute';

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="star-rating" aria-label={`${rating} stars`}>
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
    </span>
  );
}

function ThemePreview({ colors }: { colors: string[] }) {
  return (
    <div className="theme-preview">
      {colors.map((c, i) => <div key={i} className="theme-preview-swatch" style={{ background: c }} />)}
    </div>
  );
}

export default function CommunityPanel() {
  const [tab, setTab]                 = useState<Tab>('plugins');
  const [plugins, setPlugins]         = useState<Plugin[]>([]);
  const [registry, setRegistry]       = useState<any[]>([]);
  const [themes, setThemes]           = useState<CommunityTheme[]>([]);
  const [installedThemes, setInstalledThemes] = useState<CommunityTheme[]>([]);
  const [themeQuery, setThemeQuery]   = useState('');
  const [themeTag, setThemeTag]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [appliedTheme, setAppliedTheme] = useState<string | null>(
    () => localStorage.getItem('devnoder-community-theme')
  );

  useEffect(() => {
    if (tab === 'plugins') loadPlugins();
    if (tab === 'themes')  loadThemes();
  }, [tab]);

  const loadPlugins = async () => {
    const [inst, reg] = await Promise.all([pluginAPI.getInstalled(), pluginAPI.getRegistry()]);
    setPlugins(inst);
    setRegistry(reg.filter(r => !inst.find(i => i.id === r.id)));
  };

  const loadThemes = async () => {
    setLoading(true);
    const [all, inst] = await Promise.all([
      themeRegistry.browse(themeQuery, themeTag),
      themeRegistry.getInstalled(),
    ]);
    setThemes(all); setInstalledThemes(inst);
    setLoading(false);
  };

  const installPlugin = async (id: string) => {
    setLoading(true);
    try { await pluginAPI.install(id); await loadPlugins(); }
    catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const togglePlugin = async (id: string, enabled: boolean) => {
    await pluginAPI.toggle(id, enabled);
    loadPlugins();
  };

  const uninstallPlugin = async (id: string) => {
    await pluginAPI.uninstall(id);
    loadPlugins();
  };

  const installTheme = async (theme: CommunityTheme) => {
    await themeRegistry.install(theme);
    setAppliedTheme(theme.id);
    loadThemes();
  };

  const clearTheme = () => {
    themeRegistry.clearApplied();
    setAppliedTheme(null);
  };

  const exportDataset = async () => {
    const data = await computePool.exportFineTuneDataset();
    if (!data) { alert('No rated conversations to export yet.'); return; }
    const blob = new Blob([data], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'devnoder-finetune.jsonl'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="community-panel">
      <div className="community-tabs">
        {(['plugins', 'themes', 'compute'] as Tab[]).map(t => (
          <button key={t} className={`community-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}>
            <AppIcon name={t === 'plugins' ? 'puzzle' : t === 'themes' ? 'palette' : 'cpu'} size={16} />
            <span>{t === 'plugins' ? 'Plugins' : t === 'themes' ? 'Themes' : 'Compute'}</span>
          </button>
        ))}
      </div>

      {tab !== 'compute' && (
        <div role="note" style={{ padding:'0.4rem 0.7rem', fontSize:'0.72rem', lineHeight:1.4,
          color:'var(--color-text-muted)', background:'var(--color-surface)',
          borderBlockEnd:'1px solid var(--color-border)' }}>
          Registry preview — {tab} aren't fetched from a live server yet, so nothing below can actually be installed for real.
        </div>
      )}

      {/* ── Plugins ── */}
      {tab === 'plugins' && (
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
                        onChange={e => togglePlugin(p.id, e.target.checked)} />
                      <span className="toggle-track" />
                    </label>
                    <button className="plugin-remove-btn" onClick={() => uninstallPlugin(p.id)}>✕</button>
                  </div>
                </div>
              ))}
              <div className="community-divider" />
            </>
          )}

          <div className="community-section-head">Registry</div>
          {registry.length === 0 && <p className="community-empty">All plugins installed</p>}
          {registry.map((p: any) => (
            <div key={p.id} className="plugin-row">
              <span className="plugin-icon">{p.icon}</span>
              <div className="plugin-info">
                <div className="plugin-name">{p.name}</div>
                <div className="plugin-desc">{p.description}</div>
                <div className="plugin-perms">{p.permissions.join(', ')}</div>
              </div>
              <button className="install-btn" onClick={() => installPlugin(p.id)} disabled={loading || !p.entryUrl}>
                {p.entryUrl ? 'Install' : 'Not configured'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Themes ── */}
      {tab === 'themes' && (
        <div className="community-body">
          <div className="theme-search-row">
            <input className="theme-search" value={themeQuery}
              onChange={e => setThemeQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadThemes()}
              placeholder="Search themes…" />
            <select className="theme-tag-select" value={themeTag}
              onChange={e => { setThemeTag(e.target.value); loadThemes(); }}>
              <option value="">All tags</option>
              {themeRegistry.allTags().map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          {appliedTheme && (
            <div className="theme-active-bar">
              <span>Community theme active</span>
              <button className="theme-clear-btn" onClick={clearTheme}>Reset to default</button>
            </div>
          )}

          {loading && <p className="community-empty">Loading…</p>}

          {themes.map(theme => (
            <div key={theme.id} className={`theme-card ${appliedTheme === theme.id ? 'applied' : ''}`}>
              <ThemePreview colors={theme.previewColors} />
              <div className="theme-info">
                <div className="theme-name">
                  {theme.name}
                  {appliedTheme === theme.id && <span className="theme-applied-badge">Active</span>}
                </div>
                <div className="theme-author">by {theme.author}</div>
                <div className="theme-desc">{theme.description}</div>
                <div className="theme-meta">
                  <StarRating rating={theme.rating} />
                  <span className="theme-downloads">{theme.downloads.toLocaleString()} installs</span>
                </div>
                <div className="theme-tags">
                  {theme.tags.map(t => <span key={t} className="theme-tag">{t}</span>)}
                </div>
              </div>
              <button className="install-btn"
                onClick={() => installTheme(theme)}
                disabled={appliedTheme === theme.id}>
                {appliedTheme === theme.id ? 'Applied' : 'Apply'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Compute ── */}
      {tab === 'compute' && (
        <div className="community-body">
          <div className="compute-card">
            <div className="compute-card-title">Cloud Compute Pool</div>
            <div className="compute-unavailable" role="status">
              <strong>Community compute is not configured</strong>
              <p>No tasks are being offered or executed, and this browser cannot contribute CPU cycles or earn credits in this release.</p>
            </div>
          </div>

          <div className="compute-card">
            <div className="compute-card-title">Fine-tune Export</div>
            <p className="compute-desc">
              Download a local JSONL file of conversations rated 4 or 5 stars. This exports your data only; model fine-tuning is not provided by this app.
            </p>
            <button className="install-btn" onClick={exportDataset}><AppIcon name="download" size={15} /> Export dataset</button>
          </div>
        </div>
      )}
    </div>
  );
}
