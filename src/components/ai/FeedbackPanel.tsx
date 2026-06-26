import React, { useState, useEffect, useCallback } from 'react';
import { feedbackStore, FeedbackEntry, Rating } from '../../services/ai/FeedbackStore';
import { finetuneExport, ExportFormat, ExportStats } from '../../services/community/FinetuneExport';
import { showToast } from '../../stores/ui';
import './FeedbackPanel.css';

const RATING_ICONS: Record<Rating, string> = { good: '👍', bad: '👎', edited: '✏️' };
const FORMAT_LABELS: Record<ExportFormat, string> = {
  alpaca: 'Alpaca JSONL',
  chatml: 'ChatML JSONL',
  dpo:    'DPO Pairs',
};

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="stat-card">
      <span className="stat-val" style={accent ? { color: accent } : {}}>{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export default function FeedbackPanel() {
  const [entries, setEntries]       = useState<FeedbackEntry[]>([]);
  const [stats, setStats]           = useState<ExportStats | null>(null);
  const [filter, setFilter]         = useState<Rating | 'all'>('all');
  const [format, setFormat]         = useState<ExportFormat>('chatml');
  const [exporting, setExporting]   = useState(false);
  const [showGuide, setShowGuide]   = useState(false);
  const [selected, setSelected]     = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    const [all, s] = await Promise.all([feedbackStore.getAll(), finetuneExport.getStats()]);
    setEntries(all);
    setStats(s);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? entries : entries.filter(e => e.rating === filter);

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const doExport = async () => {
    setExporting(true);
    try {
      const content = await finetuneExport.export(format);
      finetuneExport.download(content, format);
      showToast({ type: 'success', message: `Exported ${content.split('\n').length} entries as ${FORMAT_LABELS[format]}` });
      await load();
      if (format === 'chatml' || format === 'alpaca') setShowGuide(true);
    } catch (e: any) {
      showToast({ type: 'error', message: e.message });
    } finally {
      setExporting(false);
    }
  };

  const doDelete = async (id: number) => {
    await feedbackStore.delete(id);
    load();
  };

  const doClear = async () => {
    await feedbackStore.deleteAll();
    setSelected(new Set());
    load();
  };

  return (
    <div className="feedback-panel">
      {/* Zero-telemetry header */}
      <div className="feedback-trust-bar">
        <span className="feedback-trust-icon">🔒</span>
        <span>Your AI stays yours — all feedback stored locally, never transmitted</span>
      </div>

      {/* Stats */}
      {stats && (
        <div className="feedback-stats">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="👍 Good" value={stats.good} accent="var(--color-success)" />
          <StatCard label="👎 Bad" value={stats.bad} accent="var(--color-error)" />
          <StatCard label="✏️ Edited" value={stats.edited} accent="var(--color-turquoise)" />
          <StatCard label="DPO pairs" value={stats.dpoPairs} accent="var(--color-yellow)" />
        </div>
      )}

      {/* Export controls */}
      <div className="feedback-export-bar">
        <select className="feedback-select" value={format} onChange={e => setFormat(e.target.value as ExportFormat)}>
          {Object.entries(FORMAT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button className="feedback-export-btn" onClick={doExport} disabled={exporting || entries.length === 0}>
          {exporting ? 'Exporting…' : '⬇ Export'}
        </button>
        {entries.length > 0 && (
          <button className="feedback-clear-btn" onClick={doClear}>Clear all</button>
        )}
      </div>

      {/* Format hint */}
      <div className="feedback-format-hint">
        {format === 'alpaca' && 'Works with most fine-tuning frameworks (Axolotl, LLaMA-Factory)'}
        {format === 'chatml' && 'Optimised for Qwen2.5, Llama 3, Mistral — recommended'}
        {format === 'dpo' && `Pairs ${stats?.good ?? 0} good vs ${stats?.bad ?? 0} bad responses for Direct Preference Optimisation`}
      </div>

      {/* Training guide (shown after export) */}
      {showGuide && (
        <div className="feedback-guide">
          <div className="feedback-guide-head">
            🎓 Next: Train your model in Colab
            <button onClick={() => setShowGuide(false)}>×</button>
          </div>
          <ol className="feedback-guide-steps">
            <li><a href="https://github.com/srvel/devnoder-finetune" target="_blank" rel="noopener noreferrer">Open the QLoRA Colab notebook ↗</a></li>
            <li>Upload your exported .jsonl file</li>
            <li>Run all cells (~2h on free T4 GPU)</li>
            <li>Download the GGUF model</li>
            <li>Upload to your HuggingFace account</li>
            <li>Paste the URL in Settings → AI → Custom model</li>
          </ol>
        </div>
      )}

      {/* Filter tabs */}
      <div className="feedback-filter-tabs">
        {(['all', 'good', 'bad', 'edited'] as const).map(f => (
          <button key={f} className={`feedback-filter-tab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}>
            {f === 'all' ? `All (${entries.length})` : `${RATING_ICONS[f as Rating]} ${f} (${entries.filter(e => e.rating === f).length})`}
          </button>
        ))}
      </div>

      {/* Entries list */}
      <div className="feedback-list">
        {filtered.length === 0 && (
          <div className="feedback-empty">
            <span>🤖</span>
            <p>No {filter === 'all' ? '' : filter} feedback yet</p>
            <p className="feedback-empty-sub">Rate AI responses using 👍 👎 ✏️ in the AI panel</p>
          </div>
        )}
        {filtered.map(entry => (
          <div key={entry.id} className={`feedback-entry ${selected.has(entry.id!) ? 'selected' : ''}`}
            onClick={() => entry.id && toggleSelect(entry.id)}>
            <div className="feedback-entry-head">
              <span className="feedback-rating-icon">{RATING_ICONS[entry.rating]}</span>
              <span className="feedback-agent">{entry.agentId}</span>
              <span className="feedback-model">{entry.modelId.split('-').slice(0, 2).join('-')}</span>
              <span className="feedback-lang">{entry.language}</span>
              <span className="feedback-time">{new Date(entry.timestamp).toLocaleDateString()}</span>
              {entry.exported && <span className="feedback-exported-badge">exported</span>}
              <button className="feedback-del-btn" onClick={e => { e.stopPropagation(); entry.id && doDelete(entry.id); }}>✕</button>
            </div>
            <p className="feedback-snippet">{entry.response.slice(0, 120)}{entry.response.length > 120 ? '…' : ''}</p>
            {entry.editedResponse && (
              <p className="feedback-edit-snippet">✏️ {entry.editedResponse.slice(0, 80)}…</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
