import React, { useState, useEffect, useCallback } from 'react';
import {
  initRepo, getStatus, stageFile, unstageFile, stageAll,
  commit, getLog, getBranches, createBranch, checkoutBranch,
  FileStatus, CommitEntry, Branch,
} from '../../services/git/GitService';
import { gitHubAPI, PullRequest, Issue, CIRun } from '../../services/git/GitHubAPI';
import { syncQueue, QueuedPush } from '../../services/git/SyncQueue';
import { generateCommitMessage } from '../../services/git/CommitMessageAI';
import { bufferManager } from '../../services/editor/BufferManager';
import './GitPanel.css';

type Tab = 'changes' | 'log' | 'branches' | 'prs' | 'issues' | 'ci';

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function GitPanel() {
  const [tab, setTab]               = useState<Tab>('changes');
  const [status, setStatus]         = useState<FileStatus[]>([]);
  const [log, setLog]               = useState<CommitEntry[]>([]);
  const [branches, setBranches]     = useState<Branch[]>([]);
  const [prs, setPRs]               = useState<PullRequest[]>([]);
  const [issues, setIssues]         = useState<Issue[]>([]);
  const [ciRuns, setCiRuns]           = useState<CIRun[]>([]);
  const [queue, setQueue]           = useState<QueuedPush[]>([]);
  const [commitMsg, setCommitMsg]   = useState('');
  const [newBranch, setNewBranch]   = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [repoInfo, setRepoInfo]     = useState<{ owner: string; repo: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      await initRepo();
      const [s, l, b] = await Promise.all([getStatus(), getLog(), getBranches()]);
      setStatus(s); setLog(l); setBranches(b);
    } catch (e: any) { setError(e.message); }
  }, []);

  useEffect(() => {
    refresh();
    syncQueue.onUpdate(setQueue);
    gitHubAPI.loadToken();
  }, [refresh]);

  const openFile = async (path: string) => {
    try {
      const { readFile } = await import('../../services/git/GitService');
      const content = await readFile(path);
      bufferManager.open(path, content);
    } catch {}
  };

  const stage = async (path: string) => { await stageFile(path); refresh(); };
  const unstage = async (path: string) => { await unstageFile(path); refresh(); };
  const stageEverything = async () => { await stageAll(); refresh(); };

  const doCommit = async () => {
    if (!commitMsg.trim()) return;
    setLoading(true);
    try {
      await commit(commitMsg);
      setCommitMsg('');
      refresh();
      const { audioCueService } = await import('../../services/accessibility/AudioCueService');
      audioCueService.cue('commit-success');
    } catch (e: any) {
      setError(e.message);
      const { audioCueService } = await import('../../services/accessibility/AudioCueService');
      audioCueService.cue('commit-error');
    } finally { setLoading(false); }
  };

  const aiMessage = async () => {
    setGenerating(true);
    try {
      const staged = status.filter(f => f.staged);
      const { message } = await generateCommitMessage(staged.length ? staged : status);
      setCommitMsg(message);
    } finally { setGenerating(false); }
  };

  const loadGH = async () => {
    if (!gitHubAPI.isAuthed()) return;
    try {
      const remote = localStorage.getItem('devnoder-remote-url');
      const info = remote ? gitHubAPI.parseRemoteUrl(remote) : null;
      if (!info) return;
      setRepoInfo(info);
      const [p, i, ci] = await Promise.all([gitHubAPI.getPRs(info), gitHubAPI.getIssues(info), gitHubAPI.getCIRuns(info)]);
      setPRs(p); setIssues(i); setCiRuns(ci);
    } catch (e: any) { setError(e.message); }
  };

  useEffect(() => { if (tab === 'prs' || tab === 'issues' || tab === 'ci') loadGH(); }, [tab]);

  const staged   = status.filter(f => f.staged);
  const unstaged = status.filter(f => !f.staged && f.status !== 'unmodified');

  const statusIcon = (s: FileStatus['status']) =>
    ({ modified: '~', added: '+', deleted: '−', untracked: '?', unmodified: ' ' }[s]);
  const statusColor = (s: FileStatus['status']) =>
    ({ modified: 'var(--color-warn)', added: 'var(--color-success)', deleted: 'var(--color-error)', untracked: 'var(--color-text-muted)', unmodified: 'inherit' }[s]);

  return (
    <div className="git-panel">
      {/* Tab bar */}
      <div className="git-tabs">
        {(['changes','log','branches','prs','issues','ci'] as Tab[]).map(t => (
          <button key={t} className={`git-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'changes'  && `Changes ${status.filter(f=>f.status!=='unmodified').length ? `(${status.filter(f=>f.status!=='unmodified').length})` : ''}`}
            {t === 'log'      && 'Log'}
            {t === 'branches' && 'Branches'}
            {t === 'prs'      && `PRs${prs.length ? ` (${prs.length})` : ''}`}
            {t === 'issues'   && `Issues${issues.length ? ` (${issues.length})` : ''}`}
            {t === 'ci'       && `CI${ciRuns.length ? ` (${ciRuns.length})` : ''}`}
          </button>
        ))}
      </div>

      {error && <div className="git-error" onClick={() => setError(null)}>{error} ×</div>}

      {/* ── Changes ── */}
      {tab === 'changes' && (
        <div className="git-body">
          {/* Staged */}
          <div className="git-section-head">
            <span>Staged ({staged.length})</span>
            {staged.length > 0 && <button className="git-link" onClick={() => staged.forEach(f=>unstage(f.path))}>Unstage all</button>}
          </div>
          {staged.map(f => (
            <div key={f.path} className="git-file-row" onClick={() => openFile(f.path)}>
              <span className="git-file-status" style={{color: statusColor(f.status)}}>{statusIcon(f.status)}</span>
              <span className="git-file-path">{f.path}</span>
              <button className="git-file-btn" onClick={e=>{e.stopPropagation();unstage(f.path);}}>−</button>
            </div>
          ))}
          {staged.length === 0 && <p className="git-empty">No staged changes</p>}

          {/* Unstaged */}
          <div className="git-section-head" style={{marginBlockStart:'0.5rem'}}>
            <span>Unstaged ({unstaged.length})</span>
            {unstaged.length > 0 && <button className="git-link" onClick={stageEverything}>Stage all</button>}
          </div>
          {unstaged.map(f => (
            <div key={f.path} className="git-file-row" onClick={() => openFile(f.path)}>
              <span className="git-file-status" style={{color: statusColor(f.status)}}>{statusIcon(f.status)}</span>
              <span className="git-file-path">{f.path}</span>
              <button className="git-file-btn git-file-btn--add" onClick={e=>{e.stopPropagation();stage(f.path);}}>+</button>
            </div>
          ))}
          {unstaged.length === 0 && <p className="git-empty">No unstaged changes</p>}

          {/* Commit */}
          <div className="git-commit-box">
            <div className="git-commit-input-row">
              <input className="git-commit-input" value={commitMsg}
                onChange={e => setCommitMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && doCommit()}
                placeholder="Commit message (feat: …)" />
              <button className="git-ai-btn" onClick={aiMessage} disabled={generating} title="AI suggest">
                {generating ? '…' : '✨'}
              </button>
            </div>
            <button className="git-commit-btn" onClick={doCommit}
              disabled={loading || !commitMsg.trim() || staged.length === 0}>
              {loading ? 'Committing…' : `Commit (${staged.length})`}
            </button>
          </div>

          {/* Sync queue */}
          {queue.filter(q=>q.status==='pending').length > 0 && (
            <div className="git-queue-notice">
              {queue.filter(q=>q.status==='pending').length} push(es) queued for when online
            </div>
          )}
        </div>
      )}

      {/* ── Log ── */}
      {tab === 'log' && (
        <div className="git-body">
          <button className="git-link" style={{padding:'0.4rem 0.6rem'}} onClick={refresh}>↻ Refresh</button>
          {log.length === 0 && <p className="git-empty">No commits yet</p>}
          {log.map(entry => (
            <div key={entry.oid} className="git-log-entry">
              <div className="git-log-msg">{entry.message}</div>
              <div className="git-log-meta">
                <span>{entry.author}</span>
                <span>{timeAgo(entry.timestamp)}</span>
                <span className="git-oid">{entry.oid.slice(0,7)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Branches ── */}
      {tab === 'branches' && (
        <div className="git-body">
          <div className="git-new-branch">
            <input className="git-branch-input" value={newBranch}
              onChange={e => setNewBranch(e.target.value)}
              placeholder="new-branch-name" />
            <button className="git-commit-btn" style={{marginBlockStart:0}}
              disabled={!newBranch.trim()}
              onClick={async () => { await createBranch(newBranch); setNewBranch(''); refresh(); }}>
              Create
            </button>
          </div>
          {branches.map(b => (
            <div key={b.name} className={`git-branch-row ${b.current ? 'current' : ''}`}>
              <span className="git-branch-indicator">{b.current ? '●' : '○'}</span>
              <span className="git-branch-name">{b.name}</span>
              {!b.current && (
                <button className="git-link" onClick={async () => { await checkoutBranch(b.name); refresh(); }}>
                  Checkout
                </button>
              )}
              {b.current && <span className="git-branch-tag">current</span>}
            </div>
          ))}
        </div>
      )}

      {/* ── PRs ── */}
      {tab === 'prs' && (
        <div className="git-body">
          {!gitHubAPI.isAuthed()
            ? <div className="git-auth-prompt">
                <p>Connect GitHub to see pull requests</p>
                <button className="git-commit-btn" onClick={() => gitHubAPI.startOAuth()}>Connect GitHub</button>
              </div>
            : prs.length === 0
              ? <p className="git-empty">No open pull requests</p>
              : prs.map(pr => (
                  <a key={pr.number} className="git-pr-row" href={pr.html_url} target="_blank" rel="noopener noreferrer">
                    <span className="git-pr-num">#{pr.number}</span>
                    <span className="git-pr-title">{pr.title}</span>
                    {pr.draft && <span className="git-badge">Draft</span>}
                  </a>
                ))
          }
        </div>
      )}

      {/* ── CI/CD ── */}
      {tab === 'ci' && (
        <div className="git-body">
          {!gitHubAPI.isAuthed()
            ? <div className="git-auth-prompt">
                <p>Connect GitHub to see CI/CD runs</p>
                <button className="git-commit-btn" onClick={() => gitHubAPI.startOAuth()}>Connect GitHub</button>
              </div>
            : ciRuns.length === 0
              ? <p className="git-empty">No workflow runs found</p>
              : ciRuns.map(run => (
                  <a key={run.id} className="git-pr-row" href={run.html_url} target="_blank" rel="noopener noreferrer">
                    <span className={`git-ci-dot git-ci-dot--${run.conclusion ?? run.status}`} />
                    <div style={{flex:1,minInlineSize:0}}>
                      <div className="git-pr-title">{run.name}</div>
                      <div className="git-log-meta">
                        <span>{run.status}</span>
                        {run.conclusion && <span style={{fontWeight:700,color: run.conclusion==='success' ? 'var(--color-success)' : run.conclusion==='failure' ? 'var(--color-error)' : 'var(--color-warn)'}}>{run.conclusion}</span>}
                        <span>{new Date(run.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </a>
                ))
          }
        </div>
      )}

      {/* ── Issues ── */}
      {tab === 'issues' && (
        <div className="git-body">
          {!gitHubAPI.isAuthed()
            ? <div className="git-auth-prompt">
                <p>Connect GitHub to see issues</p>
                <button className="git-commit-btn" onClick={() => gitHubAPI.startOAuth()}>Connect GitHub</button>
              </div>
            : issues.length === 0
              ? <p className="git-empty">No open issues</p>
              : issues.map(issue => (
                  <a key={issue.number} className="git-pr-row" href={issue.html_url} target="_blank" rel="noopener noreferrer">
                    <span className="git-pr-num">#{issue.number}</span>
                    <span className="git-pr-title">{issue.title}</span>
                    <div className="git-labels">
                      {issue.labels.map(l => <span key={l} className="git-badge">{l}</span>)}
                    </div>
                  </a>
                ))
          }
        </div>
      )}
    </div>
  );
}
