import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { projectHealthService, HealthReport, HealthMetric } from '../../services/health/ProjectHealthService';
import type { EmbeddingEngine } from '../../services/ai/EmbeddingEngine';
import './HealthPanel.css';

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? 'var(--color-turquoise)' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="score-ring-wrap">
      <svg className="score-ring" viewBox="0 0 88 88" aria-hidden="true">
        <circle cx="44" cy="44" r={r} fill="none" stroke="var(--color-border)" strokeWidth="8" />
        <circle
          cx="44" cy="44" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 44 44)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="score-ring-inner">
        <span className="score-number">{score}</span>
        <span className="score-grade">{grade}</span>
      </div>
    </div>
  );
}

function MetricBar({ value, status }: { value: number; status: HealthMetric['status'] }) {
  return (
    <div className="metric-bar-track" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={`metric-bar-fill bar--${status}`}
        style={{ inlineSize: `${value}%`, transition: 'inline-size 0.6s ease' }}
      />
    </div>
  );
}

function MetricCard({ metric, expanded, onToggle }: {
  metric: HealthMetric;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <article className={`metric-card metric-card--${metric.status}`} onClick={onToggle}>
      <div className="metric-card-main">
        <span className="metric-icon" aria-hidden="true">{metric.icon}</span>
        <div className="metric-info">
          <div className="metric-label">{metric.label}</div>
          <MetricBar value={metric.score} status={metric.status} />
        </div>
        <div className="metric-right">
          <span className={`metric-status-dot dot--${metric.status}`} />
          <span className="metric-value">{metric.value}</span>
          <span className="metric-expand-icon">{expanded ? '▴' : '▾'}</span>
        </div>
      </div>

      {expanded && (
        <div className="metric-detail">
          <p className="metric-detail-text">{metric.detail}</p>
          {metric.fix && (
            <div className="metric-fix">
              <span className="metric-fix-label">💡 Fix</span>
              <span>{metric.fix}</span>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function HealthPanel() {
  const { t } = useTranslation();
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'warn' | 'error'>('all');

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const r = await projectHealthService.analyse();
      setReport(r);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { run(); }, [run]);

  useEffect(() => {
    import('../../services/ai/EmbeddingEngine')
      .then(m => m.embeddingEngine.stats().then(setRagStats))
      .catch(() => {});
  }, []);

  const reindex = async () => {
    setReindexing(true);
    try {
      const { embeddingEngine } = await import('../../services/ai/EmbeddingEngine');
      await embeddingEngine.clearIndex();
      setRagStats(await embeddingEngine.stats());
    } finally { setReindexing(false); }
  };

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = report?.metrics.filter(m => {
    if (filter === 'all') return true;
    return m.status === filter;
  }) ?? [];

  const timeSince = report
    ? Math.round((Date.now() - report.generatedAt) / 1000)
    : 0;

  return (
    <div className="health-panel">
      {/* ── Header ── */}
      <div className="health-header">
        <div className="health-title-row">
          <span className="health-title">Project Health</span>
          {report && <span className="health-timestamp">{timeSince}s ago</span>}
        </div>
        <button className="health-refresh" onClick={run} disabled={loading} aria-label="Refresh">
          <span className={loading ? 'spin' : ''}>↻</span>
          {loading ? 'Analysing…' : 'Refresh'}
        </button>
      </div>

      {/* ── Score overview ── */}
      {report && !loading && (
        <div className="health-overview">
          <ScoreRing score={report.overall} grade={report.grade} />
          <div className="health-summary">
            <div className="health-project">{report.projectName}</div>
            <div className="health-counts">
              <span className="hcount hcount--good">
                {report.metrics.filter(m => m.status === 'good').length} ✓
              </span>
              <span className="hcount hcount--warn">
                {report.metrics.filter(m => m.status === 'warn').length} ⚠
              </span>
              <span className="hcount hcount--error">
                {report.metrics.filter(m => m.status === 'error').length} ✕
              </span>
            </div>
            <div className="health-filter-row">
              {(['all', 'warn', 'error'] as const).map(f => (
                <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}>
                  {f === 'all' ? 'All' : f === 'warn' ? 'Warnings' : 'Errors'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="health-loading">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      )}

      {/* ── Metric cards ── */}
      {!loading && report && (
        <div className="health-metrics">
          {filtered.length === 0 && (
            <div className="health-empty">
              <span>🎉</span>
              <p>No {filter === 'warn' ? 'warnings' : 'errors'} found!</p>
            </div>
          )}
          {filtered.map(m => (
            <MetricCard
              key={m.id}
              metric={m}
              expanded={expanded.has(m.id)}
              onToggle={() => toggle(m.id)}
            />
          ))}
        </div>
      )}

      {/* ── RAG Index Status (Sprint 14) ── */}
      {ragStats && (
        <div className="rag-stats-card">
          <div className="rag-stats-head">
            <span>🔍 RAG Index</span>
            <div style={{display:'flex',gap:'0.4rem',alignItems:'center'}}>
              {ragStats.files > 0 && (
                <button className="rag-rebuild-btn" onClick={() => setShowFileList(v => !v)}>
                  {showFileList ? '▴ Files' : `▾ ${ragStats.files} files`}
                </button>
              )}
              <button className="rag-rebuild-btn" onClick={reindex} disabled={reindexing}>
                {reindexing ? 'Clearing…' : '↺ Rebuild'}
              </button>
            </div>
          </div>
          <div className="rag-stats-row">
            <span>{ragStats.files} files</span>
            <span>{ragStats.chunks} chunks</span>
            <span>~{ragStats.sizeKB} KB</span>
            {ragStats.lastIndexed && (
              <span>last: {new Date(ragStats.lastIndexed).toLocaleDateString()}</span>
            )}
          </div>
          {!ragStats.files && (
            <div className="rag-empty">No files indexed yet — open and edit files to build the index</div>
          )}
          {showFileList && ragStats.fileList.length > 0 && (
            <div className="rag-file-list">
              {ragStats.fileList.slice(0, 20).map(f => (
                <div key={f.path} className="rag-file-row">
                  <span className="rag-file-path">{f.path}</span>
                  <span className="rag-file-chunks">{f.chunks} chunks</span>
                  <span className="rag-file-date">{new Date(f.updatedAt).toLocaleDateString()}</span>
                </div>
              ))}
              {ragStats.fileList.length > 20 && (
                <div className="rag-file-more">+{ragStats.fileList.length - 20} more files</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Footer note ── */}
      <div className="health-footer">
        <span>🔒 All analysis runs locally — zero telemetry</span>
      </div>
    </div>
  );
}
