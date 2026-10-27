import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { $buffers, $activeBuffer } from '../../services/editor/BufferManager';
import { bufferManager } from '../../services/editor/BufferManager';
import { previewService, PreviewLog, DeployResult, TunnelResult } from '../../services/preview/PreviewService';
import { listFiles, readFile } from '../../services/git/GitService';
import './PreviewPanel.css';

type Tab = 'preview' | 'share' | 'deploy' | 'logs';

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}

export default function PreviewPanel() {
  const [tab, setTab]           = useState<Tab>('preview');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
  const [previewBuilding, setPreviewBuilding] = useState(false);
  const [tunnel, setTunnel]     = useState<TunnelResult | null>(null);
  const [qrSvg, setQrSvg]       = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [history, setHistory]   = useState<DeployResult[]>([]);
  const [logs, setLogs]         = useState<PreviewLog[]>([]);
  const [tunneling, setTunneling] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const buffers   = useStore($buffers);
  const activeId  = useStore($activeBuffer);
  const activeBuffer = buffers.find(b => b.id === activeId);

  useEffect(() => {
    const handleLog = (log: PreviewLog) => setLogs(prev => [...prev, log]);
    previewService.onLog(handleLog);
    setHistory(previewService.getDeployHistory());
    return () => { previewService.offLog(handleLog); previewService.cleanup(); };
  }, []);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const buildPreview = useCallback(async () => {
    setPreviewBuilding(true);
    setPreviewMessage(null);
    try {
      await bufferManager.saveAll();
      const paths = await listFiles();
      const files: Record<string, string> = {};
      for (const path of paths) files[path] = await readFile(path);
      const htmlPaths = paths.filter(path => /\.html?$/i.test(path));
      const entryPath = files['index.html'] !== undefined
        ? 'index.html'
        : activeBuffer?.path && files[activeBuffer.path] !== undefined && /\.html?$/i.test(activeBuffer.path)
          ? activeBuffer.path
          : htmlPaths[0];
      if (!entryPath) {
        setPreviewUrl(null);
        setPreviewWarnings([]);
        setPreviewMessage('No HTML entry file found. Create index.html or open an HTML file to preview this static project.');
        return;
      }
      const built = previewService.buildProjectBlobPreview(files, entryPath);
      setPreviewUrl(built.url);
      setPreviewWarnings(built.warnings);
    } catch (error) {
      setPreviewUrl(null);
      setPreviewMessage(error instanceof Error ? error.message : 'The project preview could not be built.');
    } finally {
      setPreviewBuilding(false);
    }
  }, [activeBuffer?.path]);

  useEffect(() => {
    if (tab !== 'preview') return;
    const timer = window.setTimeout(() => { void buildPreview(); }, 250);
    return () => window.clearTimeout(timer);
  }, [tab, activeBuffer?.path, activeBuffer?.content, buildPreview]);

  const openTunnel = async () => {
    setTunneling(true);
    try {
      const t = await previewService.openTunnel(5173);
      setTunnel(t);
      if (t.url) {
        const svg = await previewService.generateQR(t.url);
        setQrSvg(svg);
      }
    } finally { setTunneling(false); }
  };

  const deploy = async () => {
    setDeploying(true);
    try {
      // Deploy the real project file tree, not just whatever buffer happens
      // to be open — a single active file was never a deployable site.
      const paths = await listFiles();
      const files: Record<string, string> = {};
      for (const path of paths) {
        try { files[path] = await readFile(path); } catch { /* skip unreadable */ }
      }
      if (Object.keys(files).length === 0) return;
      await previewService.deploy(files);
      setHistory(previewService.getDeployHistory());
    } catch {}
    finally { setDeploying(false); }
  };

  return (
    <div className="preview-panel">
      <div className="preview-tabs">
        {(['preview','share','deploy','logs'] as Tab[]).map(t => (
          <button key={t} className={`preview-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}>
            {t === 'preview' ? '👁 Preview'
              : t === 'share' ? '🔗 Share'
              : t === 'deploy' ? '🚀 Deploy'
              : `📋 Logs${logs.length ? ` (${logs.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* Preview */}
      {tab === 'preview' && (
        <div className="preview-body">
          <div className="preview-toolbar">
            <button className="preview-btn" onClick={() => void buildPreview()} disabled={previewBuilding}>
              {previewBuilding ? 'Building…' : '↺ Refresh'}
            </button>
            {previewUrl && (
              <span className="preview-url-label">Project snapshot · {activeBuffer?.path ?? 'index.html'}</span>
            )}
          </div>
          {previewMessage && <div className="preview-warning" role="status">{previewMessage}</div>}
          {previewWarnings.length > 0 && (
            <div className="preview-warning" role="status">
              <strong>Preview limits</strong>
              <ul>{previewWarnings.map((warning, index) => <li key={`${index}:${warning}`}>{warning}</li>)}</ul>
            </div>
          )}
          {previewUrl
            ? <iframe className="preview-frame" src={previewUrl} title="Live preview"
                sandbox="allow-scripts" />
            : <div className="preview-empty">
                <span>👁</span><p>{previewMessage ?? 'Create or open an HTML file to preview this project'}</p>
              </div>
          }
        </div>
      )}

      {/* Share */}
      {tab === 'share' && (
        <div className="preview-body preview-share">
          <p className="share-desc">Open a tunnel to share your local dev server from Termux or anywhere running on port 5173.</p>
          <button className="preview-action-btn" onClick={openTunnel} disabled={tunneling || tunnel?.active}>
            {tunneling ? 'Opening tunnel…' : tunnel?.active ? '✅ Tunnel active' : '⚡ Open Tunnel'}
          </button>
          {tunnel?.active && tunnel.url && (
            <>
              <a className="share-url" href={tunnel.url} target="_blank" rel="noopener noreferrer">{tunnel.url}</a>
              <button className="preview-btn" onClick={() => navigator.clipboard.writeText(tunnel.url)}>Copy URL</button>
              {qrSvg && <div className="share-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />}
            </>
          )}
          {tunnel && !tunnel.active && (
            <p className="share-error">Tunnel unavailable — deploy the executor Worker first.</p>
          )}
        </div>
      )}

      {/* Deploy */}
      {tab === 'deploy' && (
        <div className="preview-body preview-deploy">
          <div className="deploy-card">
            <h3>Deploy to Cloudflare Pages</h3>
            <p>Deploys the current file via the executor Worker. For full builds, run <code>npm run build</code> + <code>wrangler pages deploy dist</code> locally.</p>
            <button className="preview-action-btn" onClick={deploy} disabled={deploying || !activeBuffer}>
              {deploying ? 'Deploying…' : '🚀 Deploy current file'}
            </button>
          </div>
          {history.length > 0 && (
            <div className="deploy-history">
              <div className="deploy-history-head">Recent deploys</div>
              {history.map((d, i) => (
                <div key={i} className="deploy-entry">
                  <a className="deploy-url" href={d.url} target="_blank" rel="noopener noreferrer">{d.url}</a>
                  <span className="deploy-time">{timeAgo(d.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Logs */}
      {tab === 'logs' && (
        <div className="preview-body preview-logs">
          <div className="logs-toolbar">
            <button className="preview-btn" onClick={() => { previewService.clearLogs(); setLogs([]); }}>Clear</button>
          </div>
          <div className="logs-list">
            {logs.length === 0 && <p className="preview-empty-text">No logs yet</p>}
            {logs.map((log, i) => (
              <div key={i} className={`log-entry log-entry--${log.level}`}>
                <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className="log-msg">{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
