import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { offlineDocsService, DocSource, DocPage } from '../../services/docs/OfflineDocsService';
import './DocsPanel.css';

export default function DocsPanel() {
  const { t } = useTranslation();
  const [sources, setSources] = useState<DocSource[]>([]);
  const [selected, setSelected] = useState<DocSource | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DocPage[]>([]);
  const [searching, setSearching] = useState(false);
  const [caching, setCaching] = useState<string | null>(null);
  const [cacheProgress, setCacheProgress] = useState('');
  const [viewUrl, setViewUrl] = useState<string | null>(null);

  useEffect(() => {
    offlineDocsService.getSources().then(setSources);
  }, []);

  const search = useCallback(async () => {
    if (!selected || !query.trim()) return;
    setSearching(true);
    try {
      const res = await offlineDocsService.search(selected.id, query);
      setResults(res);
    } finally {
      setSearching(false);
    }
  }, [selected, query]);

  const handleCache = async (src: DocSource) => {
    setCaching(src.id);
    try {
      await offlineDocsService.cacheSource(src.id, (url, done, total) => {
        setCacheProgress(`${done + 1}/${total}: ${url.split('/').pop()}`);
      });
      const updated = await offlineDocsService.getSources();
      setSources(updated);
    } finally {
      setCaching(null);
      setCacheProgress('');
    }
  };

  const handleClear = async (src: DocSource) => {
    await offlineDocsService.clearSource(src.id);
    setSources(await offlineDocsService.getSources());
  };

  return (
    <div className="docs-panel">
      {/* ── Source list ── */}
      <div className="docs-sources">
        {sources.map(src => (
          <button
            key={src.id}
            className={`docs-source-btn ${selected?.id === src.id ? 'active' : ''}`}
            onClick={() => { setSelected(src); setResults([]); setQuery(''); }}
          >
            <span className="docs-source-icon">{src.icon}</span>
            <span className="docs-source-name">{src.name}</span>
            {src.cached && <span className="docs-cached-dot" title="Cached offline" />}
          </button>
        ))}
      </div>

      {/* ── Detail pane ── */}
      {selected ? (
        <div className="docs-detail">
          {/* Search bar */}
          <div className="docs-search-bar">
            <input
              className="docs-search-input"
              value={query}
              placeholder={`Search ${selected.name}…`}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
            />
            <button className="docs-search-btn" onClick={search} disabled={searching}>
              {searching ? '…' : '🔍'}
            </button>
          </div>

          {/* Cache controls */}
          <div className="docs-cache-row">
            {selected.cached ? (
              <>
                <span className="docs-cache-status">
                  ✅ Cached offline {selected.cacheSize ? `(${offlineDocsService.formatCacheSize(selected.cacheSize)})` : ''}
                </span>
                <button className="docs-cache-btn docs-cache-btn--clear"
                  onClick={() => handleClear(selected)}>
                  Clear
                </button>
              </>
            ) : (
              <>
                <span className="docs-cache-status">Not cached</span>
                <button
                  className="docs-cache-btn"
                  onClick={() => handleCache(selected)}
                  disabled={caching === selected.id}
                >
                  {caching === selected.id ? `Caching… ${cacheProgress}` : '⬇ Cache Offline'}
                </button>
              </>
            )}
          </div>

          {/* Results */}
          <div className="docs-results">
            {results.length === 0 && !searching && (
              <div className="docs-empty">
                <span>{selected.icon}</span>
                <p>Search {selected.name} above, or</p>
                <a href={selected.baseUrl} target="_blank" rel="noopener noreferrer"
                  className="docs-open-link">
                  Open {selected.name} ↗
                </a>
              </div>
            )}
            {results.map((page, i) => (
              <button key={i} className="docs-result-item" onClick={() => setViewUrl(page.url)}>
                <div className="docs-result-title">{page.title}</div>
                {page.excerpt && <div className="docs-result-excerpt">{page.excerpt}</div>}
                <div className="docs-result-url">{page.url}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="docs-welcome">
          <span className="docs-welcome-icon">📚</span>
          <p>Select a documentation source to search or browse</p>
        </div>
      )}

      {/* ── Inline viewer (iframe) ── */}
      {viewUrl && (
        <div className="docs-viewer-overlay">
          <div className="docs-viewer-bar">
            <span className="docs-viewer-url">{viewUrl}</span>
            <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="docs-viewer-open">↗</a>
            <button className="docs-viewer-close" onClick={() => setViewUrl(null)}>×</button>
          </div>
          <iframe className="docs-viewer-frame" src={viewUrl} title="Documentation" sandbox="allow-scripts allow-same-origin" />
        </div>
      )}
    </div>
  );
}
