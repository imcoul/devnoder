import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import {
  initRepo, getStatus, stageFile, unstageFile, stageAll,
  commit, getLog, getBranches, createBranch, checkoutBranch,
  listFiles, listRemotes, setRemote, push as pushRemote, pull as pullRemote,
  readFile, writeFile, normalizeProjectPath,
  getGitAuthorConfig, saveGitAuthorConfig, isGitAuthorConfigured, type GitAuthor,
  FileStatus, CommitEntry, Branch,
} from '../../services/git/GitService';
import { gitHubAPI, PullRequest, Issue, CIRun } from '../../services/git/GitHubAPI';
import { syncQueue, QueuedPush } from '../../services/git/SyncQueue';
import { generateCommitMessage } from '../../services/git/CommitMessageAI';
import { $buffers, bufferManager } from '../../services/editor/BufferManager';
import { diffTracker } from '../../services/ai/DiffTracker';
import { createProjectArchive } from '../../services/project/ProjectArchive';
import { db } from '../../services/storage/db';
import { $projectContext } from '../../stores/projectContext';
import { AppIcon } from '../brand/AppIcon';
import DiffViewer from '../editor/DiffViewer';
import './GitPanel.css';

type Tab = 'files' | 'changes' | 'diff' | 'log' | 'branches' | 'prs' | 'issues' | 'ci';

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function GitPanel() {
  const buffers = useStore($buffers);
  const [tab, setTab]               = useState<Tab>('changes');
  const [status, setStatus]         = useState<FileStatus[]>([]);
  const [files, setFiles]           = useState<string[]>([]);
  const [log, setLog]               = useState<CommitEntry[]>([]);
  const [branches, setBranches]     = useState<Branch[]>([]);
  const [prs, setPRs]               = useState<PullRequest[]>([]);
  const [issues, setIssues]         = useState<Issue[]>([]);
  const [ciRuns, setCiRuns]           = useState<CIRun[]>([]);
  const projectContext = useStore($projectContext);
  const [queue, setQueue]           = useState<QueuedPush[]>([]);
  const [commitMsg, setCommitMsg]   = useState('');
  const [gitAuthor, setGitAuthor] = useState<GitAuthor>({ name: 'Local Developer', email: 'local@devnoder.invalid' });
  const [gitAuthorConfigured, setGitAuthorConfigured] = useState(false);
  const [savingGitAuthor, setSavingGitAuthor] = useState(false);
  const [gitAuthorMessage, setGitAuthorMessage] = useState<string | null>(null);
  const [newBranch, setNewBranch]   = useState('');
  const [newFilePath, setNewFilePath] = useState('');
  const [creatingFile, setCreatingFile] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [repoInfo, setRepoInfo]     = useState<{ owner: string; repo: string } | null>(null);
  const [githubAuthReady, setGithubAuthReady] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubTokenInput, setGithubTokenInput] = useState('');
  const [githubConnecting, setGithubConnecting] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [remoteDraft, setRemoteDraft] = useState('');
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [diffPath, setDiffPath]     = useState<string | null>(null);
  const [diffPatch, setDiffPatch]   = useState<string>('');

  const refresh = useCallback(async () => {
    try {
      await initRepo();
      const [s, l, b, f, remotes] = await Promise.all([
        getStatus(), getLog(), getBranches(), listFiles(), listRemotes(),
      ]);
      setStatus(s); setLog(l); setBranches(b); setFiles(f.sort((a, b) => a.localeCompare(b)));
      const origin = remotes.find(remote => remote.remote === 'origin');
      setRemoteUrl(origin?.url ?? '');
      if (origin) setRemoteDraft(current => current || origin.url);
      if (origin && gitHubAPI.parseRemoteUrl(origin.url)) localStorage.setItem('devnoder-remote-url', origin.url);
    } catch (e: any) { setError(e.message); }
  }, []);

  const activeProjectId = projectContext?.project?.id ?? null;
  useEffect(() => {
    let current = true;
    setGitAuthorConfigured(false);
    setGitAuthorMessage(null);
    void getGitAuthorConfig().then(author => {
      if (!current) return;
      setGitAuthor(author);
      setGitAuthorConfigured(isGitAuthorConfigured(author));
    }).catch(error => {
      if (current) setError(error instanceof Error ? error.message : 'Could not read this repository’s commit identity.');
    });
    return () => { current = false; };
  }, [activeProjectId]);

  useEffect(() => {
    refresh();
    syncQueue.onUpdate(setQueue);
    void gitHubAPI.loadToken().then(connected => {
      setGithubConnected(connected);
      setGithubAuthReady(true);
    }).catch(() => {
      setGithubConnected(false);
      setGithubAuthReady(true);
    });
  }, [refresh]);

  const persistedBufferKey = buffers
    .filter(buffer => !buffer.dirty && !buffer.saving)
    .map(buffer => `${buffer.projectId}:${buffer.path}:${buffer.content}`)
    .join('\u001e');

  useEffect(() => {
    if (!persistedBufferKey) return;
    const timer = setTimeout(() => { void refresh(); }, 150);
    return () => clearTimeout(timer);
  }, [persistedBufferKey, refresh]);

  const openFile = async (path: string) => {
    try {
      const { readFile } = await import('../../services/git/GitService');
      const content = await readFile(path);
      bufferManager.open(path, content);
    } catch (e: any) { setError(e.message); }
  };

  const createFile = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const path = normalizeProjectPath(newFilePath.trim());
      if (files.includes(path)) throw new Error(`A file already exists at ${path}.`);
      await writeFile(path, '');
      bufferManager.open(path, '');
      setNewFilePath('');
      setCreatingFile(false);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const exportProject = async () => {
    if (exporting) return;
    setExporting(true);
    setError(null);
    setExportMessage(null);
    let objectUrl: string | null = null;
    try {
      const archive = await createProjectArchive();
      objectUrl = URL.createObjectURL(archive.blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = archive.filename;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setExportMessage(`Downloaded ${archive.filename} (${archive.fileCount} files)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Project ZIP export failed.');
    } finally {
      if (objectUrl) window.setTimeout(() => URL.revokeObjectURL(objectUrl!), 1000);
      setExporting(false);
    }
  };

  const stage = async (path: string) => { await stageFile(path); refresh(); };
  const unstage = async (path: string) => { await unstageFile(path); refresh(); };
  const stageEverything = async () => { await stageAll(); refresh(); };

  const saveCommitIdentity = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingGitAuthor(true);
    setError(null);
    setGitAuthorMessage(null);
    try {
      const saved = await saveGitAuthorConfig(gitAuthor);
      setGitAuthor(saved);
      setGitAuthorConfigured(true);
      setGitAuthorMessage(`This repository will attribute commits to ${saved.name} <${saved.email}>.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this repository’s commit identity.');
      setGitAuthorConfigured(false);
    } finally {
      setSavingGitAuthor(false);
    }
  };

  const doCommit = async () => {
    if (!commitMsg.trim()) return;
    if (!gitAuthorConfigured) {
      setError('Save your own commit name and email before creating a commit.');
      return;
    }
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

  const connectGitHubToken = async () => {
    setGithubConnecting(true);
    setError(null);
    try {
      await gitHubAPI.connectWithToken(githubTokenInput);
      setGithubTokenInput('');
      setGithubConnected(true);
      if (tab === 'prs' || tab === 'issues' || tab === 'ci') await loadGH();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'GitHub connection failed.');
    } finally {
      setGithubConnecting(false);
    }
  };

  const configureRemote = async () => {
    const parsed = gitHubAPI.parseRemoteUrl(remoteDraft.trim());
    if (!parsed) {
      setError('Enter an HTTPS or SSH repository URL hosted on github.com.');
      return;
    }
    const url = `https://github.com/${parsed.owner}/${parsed.repo}.git`;
    setSyncBusy(true);
    setError(null);
    setSyncMessage(null);
    try {
      await setRemote('origin', url);
      if (projectContext?.project) {
        await db.projects.put({ ...projectContext.project, gitRemote: url, updatedAt: Date.now() });
      }
      localStorage.setItem('devnoder-remote-url', url);
      setRemoteDraft('');
      setRemoteUrl(url);
      setSyncMessage('GitHub origin saved. Commit changes, then push or pull.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this GitHub remote.');
    } finally {
      setSyncBusy(false);
    }
  };

  const syncProject = async (direction: 'push' | 'pull') => {
    if (syncBusy) return;
    setSyncBusy(true);
    setError(null);
    setSyncMessage(null);
    try {
      if (!remoteUrl) throw new Error('Set a GitHub origin before syncing.');
      if (!await gitHubAPI.loadToken()) throw new Error('Connect a GitHub token in the PRs, Issues, or CI tab first.');
      await bufferManager.saveAll();
      const currentStatus = await getStatus();
      if (currentStatus.some(file => file.status !== 'unmodified')) {
        throw new Error('Commit or discard local changes before syncing so no work is silently omitted or overwritten.');
      }

      if (direction === 'push') {
        await pushRemote('origin', undefined, gitHubAPI.getAccessToken() ?? undefined);
        setSyncMessage('Push completed.');
      } else {
        const openBuffers = buffers.filter(buffer => buffer.projectId === projectContext?.project?.id);
        await pullRemote('origin', undefined, gitHubAPI.getAccessToken() ?? undefined);
        for (const buffer of openBuffers) {
          try {
            bufferManager.replaceSaved(buffer.path, await readFile(buffer.path));
          } catch {
            await bufferManager.close(buffer.id);
          }
        }
        setSyncMessage('Pull completed. Open files were refreshed from the updated project.');
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Git ${direction} failed.`);
    } finally {
      setSyncBusy(false);
    }
  };

  const githubAuthPrompt = (message: string) => (
    <div className="git-auth-prompt">
      <p>{message}</p>
      <label className="git-token-field">
        GitHub personal access token
        <input type="password" autoComplete="new-password" spellCheck={false}
          aria-label="GitHub personal access token" value={githubTokenInput}
          onChange={event => setGithubTokenInput(event.target.value)} />
      </label>
      <button className="git-commit-btn" onClick={connectGitHubToken}
        disabled={!githubAuthReady || githubConnecting || !githubTokenInput.trim()}>
        {githubConnecting ? 'Checking token…' : 'Connect with token'}
      </button>
      <p className="git-token-note">Use a fine-grained token with only the repository permissions you need. Remote sync requires Contents read/write; PRs, issues and Actions need their matching read permissions. The token is encrypted in this browser’s device-bound vault; active same-origin scripts can still access it while connected.</p>
    </div>
  );

  const disconnectGitHub = () => {
    gitHubAPI.clearToken();
    setGithubConnected(false);
    setPRs([]);
    setIssues([]);
    setCiRuns([]);
    setRepoInfo(null);
    setSyncMessage('GitHub token removed from this browser.');
  };

  const githubConnectedHeader = githubConnected ? (
    <div className="git-section-head">
      <span>GitHub connected</span>
      <button className="git-link" onClick={disconnectGitHub}>Disconnect</button>
    </div>
  ) : null;

  useEffect(() => {
    if (githubAuthReady && (tab === 'prs' || tab === 'issues' || tab === 'ci')) void loadGH();
  }, [tab, githubAuthReady, githubConnected]);

  const staged   = status.filter(f => f.staged);
  const unstaged = status.filter(f => !f.staged && f.status !== 'unmodified');

  const statusIcon = (s: FileStatus['status']) =>
    ({ modified: '~', added: '+', deleted: '−', untracked: '?', unmodified: ' ' }[s]);
  const statusColor = (s: FileStatus['status']) =>
    ({ modified: 'var(--color-warn)', added: 'var(--color-success)', deleted: 'var(--color-error)', untracked: 'var(--color-text-muted)', unmodified: 'inherit' }[s]);

  return (
    <div className="git-panel">
      {/* Tab bar */}
      <div className="git-tabs" role="tablist" aria-label="Git">
        {(['files','changes','diff','log','branches','prs','issues','ci'] as Tab[]).map(t => (
          <button key={t} className={`git-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}
            role="tab" aria-selected={tab === t}>
            {t === 'files'    && `Files${files.length ? ` (${files.length})` : ''}`}
            {t === 'changes'  && `Changes ${status.filter(f=>f.status!=='unmodified').length ? `(${status.filter(f=>f.status!=='unmodified').length})` : ''}`}
            {t === 'diff'     && `Diff${diffPath ? ` (${diffPath.split('/').pop()})` : ''}`}
            {t === 'log'      && 'Log'}
            {t === 'branches' && 'Branches'}
            {t === 'prs'      && `PRs${prs.length ? ` (${prs.length})` : ''}`}
            {t === 'issues'   && `Issues${issues.length ? ` (${issues.length})` : ''}`}
            {t === 'ci'       && `CI`}
          </button>
        ))}
      </div>

      {error && <div className="git-error" onClick={() => setError(null)}>{error} ×</div>}

      {/* ── Project files ── */}
      {tab === 'files' && (
        <div className="git-body">
          <div className="git-section-head">
            <span>Project files</span>
            <div className="git-file-actions">
              <button className="git-link" onClick={exportProject} disabled={exporting} aria-label="Download project ZIP">
                {exporting ? 'Preparing ZIP…' : 'Download ZIP'}
              </button>
              <button className="git-link" onClick={() => setCreatingFile(value => !value)}>
                {creatingFile ? 'Cancel' : '+ New file'}
              </button>
            </div>
          </div>
          {exportMessage && <div className="git-export-status" role="status">{exportMessage}</div>}
          {creatingFile && (
            <form className="git-new-branch" onSubmit={createFile}>
              <input className="git-branch-input" autoFocus value={newFilePath}
                onChange={e => setNewFilePath(e.target.value)}
                aria-label="Project-relative file path" placeholder="src/main.ts" />
              <button className="git-commit-btn" type="submit" disabled={!newFilePath.trim()}>Create</button>
            </form>
          )}
          {files.map(path => (
            <button key={path} type="button" className="git-file-row" onClick={() => openFile(path)}>
              <span className="git-file-status" aria-hidden="true">{path.includes('/') ? '↳' : '·'}</span>
              <span className="git-file-path">{path}</span>
            </button>
          ))}
          {files.length === 0 && !creatingFile && (
            <div className="git-empty">
              <p>This project has no files yet.</p>
              <button className="git-link" onClick={() => setCreatingFile(true)}>Create the first file</button>
            </div>
          )}
        </div>
      )}

      {/* ── Changes ── */}
      {tab === 'changes' && (
        <div className="git-body">
          <div className="git-section-head"><span>GitHub remote</span></div>
          <form className="git-remote-form" onSubmit={event => { event.preventDefault(); void configureRemote(); }}>
            <label htmlFor="git-remote-url">HTTPS or SSH GitHub repository URL</label>
            <div className="git-remote-input-row">
              <input id="git-remote-url" value={remoteDraft} onChange={event => setRemoteDraft(event.target.value)}
                placeholder="https://github.com/owner/repository.git" autoCapitalize="none" autoCorrect="off" />
              <button className="git-commit-btn" type="submit" disabled={!remoteDraft.trim() || syncBusy}>
                {remoteUrl ? 'Update origin' : 'Save origin'}
              </button>
            </div>
          </form>
          <div className="git-remote-sync">
            <div className="git-remote-url" title={remoteUrl}>{remoteUrl || 'No origin configured'}</div>
            <div className="git-remote-buttons">
              <button className="git-commit-btn" onClick={() => void syncProject('pull')} disabled={!remoteUrl || syncBusy || !gitAuthorConfigured}>
                {syncBusy ? 'Syncing…' : 'Pull'}
              </button>
              <button className="git-commit-btn" onClick={() => void syncProject('push')} disabled={!remoteUrl || syncBusy}>
                {syncBusy ? 'Syncing…' : 'Push'}
              </button>
            </div>
            {!githubConnected && <p className="git-token-note">Connect a fine-grained GitHub token in the PRs, Issues, or CI tab before syncing. Commit local changes before push/pull.</p>}
            {!gitAuthorConfigured && <p className="git-token-note">Set your commit identity below before pulling or creating commits. DevNoder will not attribute your work to Srvel.</p>}
            {syncMessage && <p className="git-sync-status" role="status">{syncMessage}</p>}
          </div>

          <form className="git-author-box" onSubmit={saveCommitIdentity}>
            <div className="git-author-heading">
              <strong>Commit identity</strong>
              <span>{gitAuthorConfigured ? 'Saved in this repository' : 'Required before commit or pull'}</span>
            </div>
            <p>Git records this name and email in commits visible on remotes. This is separate from GitHub sign-in. Use your own email or a GitHub noreply address.</p>
            <div className="git-author-fields">
              <label>Name<input value={gitAuthor.name} maxLength={100} autoComplete="name"
                aria-label="Git commit author name"
                onChange={event => { setGitAuthor(current => ({ ...current, name: event.target.value })); setGitAuthorConfigured(false); setGitAuthorMessage(null); }} /></label>
              <label>Email<input type="email" value={gitAuthor.email} maxLength={254} autoComplete="email"
                aria-label="Git commit author email"
                onChange={event => { setGitAuthor(current => ({ ...current, email: event.target.value })); setGitAuthorConfigured(false); setGitAuthorMessage(null); }} /></label>
            </div>
            <button className="git-commit-btn" type="submit" disabled={savingGitAuthor || !isGitAuthorConfigured(gitAuthor)}>
              {savingGitAuthor ? 'Saving identity…' : gitAuthorConfigured ? 'Update identity' : 'Save commit identity'}
            </button>
            {gitAuthorMessage && <p className="git-sync-status" role="status">{gitAuthorMessage}</p>}
          </form>

          {/* Staged */}
          <div className="git-section-head">
            <span>Staged ({staged.length})</span>
            {staged.length > 0 && <button className="git-link" onClick={() => staged.forEach(f=>unstage(f.path))}>Unstage all</button>}
          </div>
          {staged.map(f => (
            <div key={f.path} className="git-file-row" onClick={() => { openFile(f.path); setDiffPath(f.path); setDiffPatch(diffTracker.getDiff(f.path)); setTab('diff'); }}>
              <span className="git-file-status" style={{color: statusColor(f.status)}} aria-hidden="true">{statusIcon(f.status)}</span>
              <span className="git-file-path">{f.path}</span>
              <button className="git-file-btn" aria-label={`Unstage ${f.path}`} onClick={e=>{e.stopPropagation();unstage(f.path);}}>−</button>
            </div>
          ))}
          {staged.length === 0 && <p className="git-empty">No staged changes</p>}

          {/* Unstaged */}
          <div className="git-section-head" style={{marginBlockStart:'0.5rem'}}>
            <span>Unstaged ({unstaged.length})</span>
            {unstaged.length > 0 && <button className="git-link" onClick={stageEverything}>Stage all</button>}
          </div>
          {unstaged.map(f => (
            <div key={f.path} className="git-file-row" onClick={() => { openFile(f.path); setDiffPath(f.path); setDiffPatch(diffTracker.getDiff(f.path)); }}>
              <span className="git-file-status" style={{color: statusColor(f.status)}} aria-hidden="true">{statusIcon(f.status)}</span>
              <span className="git-file-path">{f.path}</span>
              <button className="git-file-btn git-file-btn--add" aria-label={`Stage ${f.path}`} onClick={e=>{e.stopPropagation();stage(f.path);}}>+</button>
            </div>
          ))}
          {unstaged.length === 0 && <p className="git-empty">No unstaged changes</p>}

          {/* Commit */}
          <div className="git-commit-box">
            <div className="git-commit-input-row">
              <input className="git-commit-input" value={commitMsg} aria-label="Commit message"
                onChange={e => setCommitMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && doCommit()}
                placeholder="Commit message (feat: …)" />
              <button className="git-ai-btn" onClick={aiMessage} disabled={generating}
                aria-label="AI suggest commit message" title="AI suggest">
                {generating ? '…' : <AppIcon name="sparkle" size={16} />}
              </button>
            </div>
            <button className="git-commit-btn" onClick={doCommit}
              disabled={loading || !commitMsg.trim() || staged.length === 0 || !gitAuthorConfigured}>
              {loading ? 'Committing…' : gitAuthorConfigured ? `Commit (${staged.length})` : 'Set identity to commit'}
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

      {/* ── Diff ── */}
      {tab === 'diff' && (
        <div className="git-body">
          {!diffPath ? (
            <div className="git-empty">
              <p>Select a file from Changes to view its diff</p>
              <button className="git-link" onClick={() => { setDiffPath(status[0]?.path ?? null); }}>View first modified file</button>
            </div>
          ) : (
            <>
              <div className="git-diff-header">
                <select className="git-diff-select" value={diffPath} onChange={e => {
                  const path = e.target.value;
                  setDiffPath(path);
                  const patch = diffTracker.getDiff(path);
                  setDiffPatch(patch);
                }}>
                  {status.filter(f => f.status !== 'unmodified').map(f => (
                    <option key={f.path} value={f.path}>{f.staged ? '✓ ' : ''}{f.path}</option>
                  ))}
                </select>
                <button className="git-link" onClick={() => openFile(diffPath)}>Open file</button>
              </div>
              <DiffViewer patch={diffPatch} filename={diffPath} />
            </>
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
            <input className="git-branch-input" value={newBranch} aria-label="New branch name"
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
              <span className="git-branch-indicator" aria-hidden="true">{b.current ? '●' : '○'}</span>
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
          {githubConnectedHeader}
          {!githubConnected
            ? githubAuthPrompt(githubAuthReady ? 'Connect GitHub to see pull requests' : 'Checking saved GitHub connection…')
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
          {githubConnectedHeader}
          {!githubConnected
            ? githubAuthPrompt(githubAuthReady ? 'Connect GitHub to see CI/CD runs' : 'Checking saved GitHub connection…')
            : ciRuns.length === 0
              ? <p className="git-empty">No workflow runs found</p>
              : ciRuns.map(run => (
                  <a key={run.id} className="git-pr-row" href={run.html_url} target="_blank" rel="noopener noreferrer">
                    <span className={`git-ci-dot git-ci-dot--${run.conclusion ?? run.status}`} aria-hidden="true" />
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
          {githubConnectedHeader}
          {!githubConnected
            ? githubAuthPrompt(githubAuthReady ? 'Connect GitHub to see issues' : 'Checking saved GitHub connection…')
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
