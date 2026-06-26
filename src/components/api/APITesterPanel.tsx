import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  apiTesterService,
  APIRequest,
  APIResponse,
  HistoryEntry,
  HttpMethod,
} from '../../services/api/APITesterService';
import './APITesterPanel.css';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'method--get', POST: 'method--post', PUT: 'method--put',
  PATCH: 'method--patch', DELETE: 'method--delete', HEAD: 'method--head', OPTIONS: 'method--options',
};

function tryPrettyJson(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
}

function statusClass(code: number) {
  if (code >= 500) return 'status--5xx';
  if (code >= 400) return 'status--4xx';
  if (code >= 300) return 'status--3xx';
  if (code >= 200) return 'status--2xx';
  return 'status--0';
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// ─── KeyVal editor ────────────────────────────────────────────────────────────
interface KVRow { key: string; value: string; enabled: boolean; }
function KVEditor({
  rows, onChange, placeholder = 'Key',
}: { rows: KVRow[]; onChange: (r: KVRow[]) => void; placeholder?: string }) {
  const update = (i: number, patch: Partial<KVRow>) => {
    const next = rows.map((r, idx) => idx === i ? { ...r, ...patch } : r);
    onChange(next);
  };
  const add = () => onChange([...rows, { key: '', value: '', enabled: true }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="kv-editor">
      {rows.map((r, i) => (
        <div className="kv-row" key={i}>
          <input type="checkbox" checked={r.enabled} onChange={e => update(i, { enabled: e.target.checked })} />
          <input className="kv-key" value={r.key} placeholder={placeholder}
            onChange={e => update(i, { key: e.target.value })} />
          <input className="kv-val" value={r.value} placeholder="Value"
            onChange={e => update(i, { value: e.target.value })} />
          <button className="kv-del" onClick={() => remove(i)} aria-label="Remove">×</button>
        </div>
      ))}
      <button className="kv-add" onClick={add}>+ Add</button>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export default function APITesterPanel() {
  const { t } = useTranslation();
  const [req, setReq] = useState<APIRequest>(apiTesterService.blank());
  const [response, setResponse] = useState<APIResponse | null>(null);
  const [sending, setSending] = useState(false);
  const [reqTab, setReqTab] = useState<'params' | 'headers' | 'body'>('params');
  const [resTab, setResTab] = useState<'body' | 'headers'>('body');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [curlModal, setCurlModal] = useState<string | null>(null);
  const [curlImport, setCurlImport] = useState('');
  const [showCurlImport, setShowCurlImport] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    apiTesterService.getHistory(50).then(setHistory);
  }, []);

  const send = useCallback(async () => {
    if (!req.url) return;
    setSending(true);
    try {
      const res = await apiTesterService.send(req);
      setResponse(res);
      apiTesterService.getHistory(50).then(setHistory);
    } finally {
      setSending(false);
    }
  }, [req]);

  const patch = (p: Partial<APIRequest>) => setReq(r => ({ ...r, ...p }));

  const copyResponse = () => {
    if (response?.body) navigator.clipboard.writeText(response.body);
  };

  const openCurl = () => setCurlModal(apiTesterService.toCurl(req));

  const importCurl = () => {
    const parsed = apiTesterService.fromCurl(curlImport);
    setReq(r => ({ ...r, ...parsed }));
    setShowCurlImport(false);
    setCurlImport('');
  };

  const loadHistory = (entry: HistoryEntry) => {
    setReq(entry.request);
    setResponse(entry.response);
    setShowHistory(false);
  };

  return (
    <div className="api-panel">
      {/* ── Toolbar ── */}
      <div className="api-toolbar">
        <button className="api-history-btn" onClick={() => setShowHistory(s => !s)}
          aria-label="History">
          <span className="icon-history" />
        </button>

        <select className={`api-method ${METHOD_COLORS[req.method]}`}
          value={req.method} onChange={e => patch({ method: e.target.value as HttpMethod })}>
          {METHODS.map(m => <option key={m}>{m}</option>)}
        </select>

        <input className="api-url" value={req.url} placeholder="https://api.example.com/endpoint"
          onChange={e => patch({ url: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && send()} />

        <button className="api-send" onClick={send} disabled={sending || !req.url}>
          {sending ? '…' : 'Send'}
        </button>
      </div>

      {/* ── curl buttons ── */}
      <div className="api-curl-row">
        <button className="api-curl-btn" onClick={openCurl}>Export cURL</button>
        <button className="api-curl-btn" onClick={() => setShowCurlImport(true)}>Import cURL</button>
      </div>

      <div className="api-body">
        {/* ── History sidebar ── */}
        {showHistory && (
          <aside className="api-history">
            <div className="api-history-head">
              <span>History</span>
              <button onClick={() => setShowHistory(false)}>×</button>
            </div>
            <div className="api-history-list">
              {history.length === 0 && <p className="api-empty">No history yet</p>}
              {history.map(h => (
                <button key={h.id} className="history-item" onClick={() => loadHistory(h)}>
                  <span className={`method-tag ${METHOD_COLORS[h.request.method]}`}>{h.request.method}</span>
                  <span className="history-url">{h.request.url}</span>
                  <span className={`history-status ${statusClass(h.response.status)}`}>{h.response.status}</span>
                </button>
              ))}
            </div>
            <button className="api-curl-btn" style={{ margin: '0.5rem' }}
              onClick={() => { apiTesterService.clearHistory(); setHistory([]); }}>
              Clear history
            </button>
          </aside>
        )}

        <div className="api-main">
          {/* ── Request tabs ── */}
          <section className="api-section">
            <div className="tab-bar">
              {(['params', 'headers', 'body'] as const).map(tab => (
                <button key={tab} className={`tab-btn ${reqTab === tab ? 'active' : ''}`}
                  onClick={() => setReqTab(tab)}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === 'params' && req.params.filter(p => p.enabled && p.key).length > 0 &&
                    <span className="tab-badge">{req.params.filter(p => p.enabled && p.key).length}</span>}
                  {tab === 'headers' && req.headers.filter(h => h.enabled && h.key).length > 0 &&
                    <span className="tab-badge">{req.headers.filter(h => h.enabled && h.key).length}</span>}
                </button>
              ))}
            </div>

            <div className="tab-content">
              {reqTab === 'params' && (
                <KVEditor rows={req.params} onChange={params => patch({ params })} />
              )}
              {reqTab === 'headers' && (
                <KVEditor rows={req.headers} onChange={headers => patch({ headers })} placeholder="Header" />
              )}
              {reqTab === 'body' && (
                <div className="body-editor">
                  <div className="body-type-row">
                    {(['none', 'json', 'form', 'text', 'xml'] as const).map(bt => (
                      <label key={bt} className="body-type-label">
                        <input type="radio" name="bodyType" value={bt}
                          checked={req.bodyType === bt} onChange={() => patch({ bodyType: bt })} />
                        {bt}
                      </label>
                    ))}
                  </div>
                  {req.bodyType !== 'none' && (
                    <textarea className="body-textarea" value={req.body}
                      placeholder={req.bodyType === 'json' ? '{\n  "key": "value"\n}' : ''}
                      onChange={e => patch({ body: e.target.value })} />
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ── Response ── */}
          {response && (
            <section className="api-section api-response">
              <div className="response-meta">
                <span className={`status-badge ${statusClass(response.status)}`}>
                  {response.status} {response.statusText}
                </span>
                <span className="response-time">{response.duration}ms</span>
                <span className="response-size">{formatSize(response.size)}</span>
                <button className="api-curl-btn" onClick={copyResponse}>Copy</button>
              </div>

              <div className="tab-bar">
                {(['body', 'headers'] as const).map(tab => (
                  <button key={tab} className={`tab-btn ${resTab === tab ? 'active' : ''}`}
                    onClick={() => setResTab(tab)}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              <div className="tab-content">
                {resTab === 'body' && (
                  <pre className="response-body">{tryPrettyJson(response.body) || <em>Empty response</em>}</pre>
                )}
                {resTab === 'headers' && (
                  <table className="response-headers-table">
                    <tbody>
                      {Object.entries(response.headers).map(([k, v]) => (
                        <tr key={k}>
                          <td className="res-header-key">{k}</td>
                          <td className="res-header-val">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          )}

          {!response && !sending && (
            <div className="api-placeholder">
              <span className="api-placeholder-icon">⚡</span>
              <p>Enter a URL and press Send</p>
            </div>
          )}

          {sending && (
            <div className="api-placeholder">
              <div className="api-spinner" />
              <p>Sending request…</p>
            </div>
          )}
        </div>
      </div>

      {/* ── cURL export modal ── */}
      {curlModal !== null && (
        <div className="api-modal-overlay" onClick={() => setCurlModal(null)}>
          <div className="api-modal" onClick={e => e.stopPropagation()}>
            <div className="api-modal-head">
              <span>cURL command</span>
              <button onClick={() => setCurlModal(null)}>×</button>
            </div>
            <pre className="api-modal-code">{curlModal}</pre>
            <button className="api-curl-btn"
              onClick={() => { navigator.clipboard.writeText(curlModal); setCurlModal(null); }}>
              Copy & Close
            </button>
          </div>
        </div>
      )}

      {/* ── cURL import modal ── */}
      {showCurlImport && (
        <div className="api-modal-overlay" onClick={() => setShowCurlImport(false)}>
          <div className="api-modal" onClick={e => e.stopPropagation()}>
            <div className="api-modal-head">
              <span>Import cURL</span>
              <button onClick={() => setShowCurlImport(false)}>×</button>
            </div>
            <textarea className="body-textarea" value={curlImport}
              placeholder="Paste your curl command here..."
              onChange={e => setCurlImport(e.target.value)} />
            <button className="api-send" style={{ marginTop: '0.5rem' }} onClick={importCurl}>
              Import
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
