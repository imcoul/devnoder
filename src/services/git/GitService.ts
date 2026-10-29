// GitService.ts — isomorphic-git + lightning-fs, full offline
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import FS from '@isomorphic-git/lightning-fs';
import { atom } from 'nanostores';
import { Buffer } from 'buffer';

// isomorphic-git's index (.git/index) parser references the Node global
// `Buffer` directly (_GitIndex.from -> updateCachedIndexFile), which Vite
// does not polyfill in the browser. This only throws the FIRST time a repo's
// index is read with no cached index yet (a genuinely fresh, zero-commit
// repo) — which the old single hardcoded /devnoder path never hit once it
// had been used a single time, so this was invisible until real multi-project
// onboarding started creating brand-new repos.
if (typeof globalThis.Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer;
}

export const fs = new FS('devnoder-fs');

// Project-scoped root. lightning-fs is one filesystem that can hold many
// sibling project directories (/projects/<id>) — only the active id changes,
// not the fs instance itself. `dir` used to be a hardcoded '/devnoder'
// constant; every function below now reads getDir() instead.
let activeProjectId = 'default';
export const $activeProjectId = atom<string>('default');

export function dirFor(id: string): string { return `/projects/${id}`; }
export function getDir(): string { return dirFor(activeProjectId); }
export function setActiveProject(id: string): void {
  activeProjectId = id;
  $activeProjectId.set(id);
}

/** Accept only canonical project-relative paths. Backslashes are rejected to
 * avoid platform-specific separator ambiguity and root traversal. */
export function normalizeProjectPath(filepath: string): string {
  if (typeof filepath !== 'string' || filepath.length === 0) {
    throw new Error('A project-relative file path is required.');
  }
  if (filepath.startsWith('/') || filepath.includes('\\') || /^[A-Za-z]:/.test(filepath)) {
    throw new Error('File paths must be relative to the active project.');
  }
  if ([...filepath].some(character => {
    const code = character.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  })) {
    throw new Error('File paths cannot contain control characters.');
  }
  const segments = filepath.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error('File paths cannot contain empty, dot, or parent-directory segments.');
  }
  return segments.join('/');
}

export interface FileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'unmodified' | 'untracked';
  staged: boolean;
}

export interface CommitEntry {
  oid: string;
  message: string;
  author: string;
  timestamp: number;
}

export interface Branch {
  name: string;
  current: boolean;
  remote?: string;
}

export interface GitAuthor {
  name: string;
  email: string;
}

export const DEFAULT_GIT_AUTHOR: GitAuthor = {
  name: 'Local Developer',
  email: 'local@devnoder.invalid',
};

export function isGitAuthorConfigured(author: GitAuthor): boolean {
  return author.name.trim().length > 0 && author.name.trim().length <= 100
    && ![...author.name].some(character => {
      const code = character.charCodeAt(0);
      return code < 0x20 || code === 0x7f;
    })
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(author.email.trim())
    && !author.email.trim().toLowerCase().endsWith('.invalid');
}

// Init or open repo
export async function initRepo(): Promise<void> {
  const dir = getDir();
  try {
    await git.resolveRef({ fs, dir, ref: 'HEAD' });
  } catch {
    await fs.promises.mkdir('/projects').catch(() => {});
    await fs.promises.mkdir(dir).catch(() => {});
    await git.init({ fs, dir, defaultBranch: 'main' });
  }

  const name = await git.getConfig({ fs, dir, path: 'user.name' });
  const email = await git.getConfig({ fs, dir, path: 'user.email' });
  if (!name || name === 'DevNoder User') {
    await git.setConfig({ fs, dir, path: 'user.name', value: DEFAULT_GIT_AUTHOR.name });
  }
  if (!email || email === 'dev@srvel.io') {
    await git.setConfig({ fs, dir, path: 'user.email', value: DEFAULT_GIT_AUTHOR.email });
  }
}

export async function getGitAuthorConfig(): Promise<GitAuthor> {
  const dir = getDir();
  return {
    name: await git.getConfig({ fs, dir, path: 'user.name' }) ?? DEFAULT_GIT_AUTHOR.name,
    email: await git.getConfig({ fs, dir, path: 'user.email' }) ?? DEFAULT_GIT_AUTHOR.email,
  };
}

export async function saveGitAuthorConfig(author: GitAuthor): Promise<GitAuthor> {
  const cleaned = { name: author.name.trim(), email: author.email.trim() };
  if (!isGitAuthorConfigured(cleaned)) {
    throw new Error('Enter your own commit name and a valid email address. Use a GitHub noreply address if you prefer not to publish your personal email.');
  }
  const dir = getDir();
  await git.setConfig({ fs, dir, path: 'user.name', value: cleaned.name });
  await git.setConfig({ fs, dir, path: 'user.email', value: cleaned.email });
  return cleaned;
}

export async function getStatus(): Promise<FileStatus[]> {
  const dir = getDir();
  const matrix = await git.statusMatrix({ fs, dir });
  return matrix
    .filter(([, head, workdir, stage]) => !(head === 1 && workdir === 1 && stage === 1))
    .map(([path, head, workdir, stage]) => {
      let status: FileStatus['status'];
      if (head === 0 && workdir === 2 && stage === 2) status = 'added';
      else if (head === 0 && workdir === 2) status = 'untracked';
      else if (head === 1 && workdir === 2) status = 'modified';
      else if (head === 1 && workdir === 0) status = 'deleted';
      else status = 'unmodified';
      return { path: String(path), status, staged: stage === 2 || stage === 3 };
    });
}

export async function stageFile(filepath: string): Promise<void> {
  const dir = getDir();
  await git.add({ fs, dir, filepath: normalizeProjectPath(filepath) });
}

export async function unstageFile(filepath: string): Promise<void> {
  const dir = getDir();
  await git.resetIndex({ fs, dir, filepath: normalizeProjectPath(filepath) });
}

export async function stageAll(): Promise<void> {
  const dir = getDir();
  const status = await getStatus();
  for (const f of status) {
    if (f.status !== 'unmodified') await git.add({ fs, dir, filepath: f.path });
  }
}

export async function commit(message: string): Promise<string> {
  const dir = getDir();
  const author = await getGitAuthorConfig();
  if (!isGitAuthorConfigured(author)) {
    throw new Error('Set your commit identity in Git > Changes before creating a commit.');
  }
  // cue fired by GitPanel after success/error
  return git.commit({ fs, dir, message, author });
}

export async function getLog(depth = 20): Promise<CommitEntry[]> {
  const dir = getDir();
  try {
    const log = await git.log({ fs, dir, depth });
    return log.map(entry => ({
      oid: entry.oid,
      message: entry.commit.message.trim(),
      author: entry.commit.author.name,
      timestamp: entry.commit.author.timestamp * 1000,
    }));
  } catch { return []; }
}

export async function getBranches(): Promise<Branch[]> {
  const dir = getDir();
  const [local, current] = await Promise.all([
    git.listBranches({ fs, dir }),
    git.currentBranch({ fs, dir }),
  ]);
  return local.map(name => ({ name, current: name === current }));
}

export async function createBranch(name: string): Promise<void> {
  const dir = getDir();
  await git.branch({ fs, dir, ref: name });
}

export async function checkoutBranch(name: string): Promise<void> {
  const dir = getDir();
  await git.checkout({ fs, dir, ref: name });
}

export async function deleteBranch(name: string): Promise<void> {
  const dir = getDir();
  await git.deleteBranch({ fs, dir, ref: name });
}

export async function push(remote = 'origin', branch?: string, token?: string): Promise<void> {
  const dir = getDir();
  const ref = branch ?? (await git.currentBranch({ fs, dir })) ?? 'main';
  await git.push({
    fs, http, dir, remote, ref,
    onAuth: token ? () => ({ username: 'x-access-token', password: token }) : undefined,
  });
}

export async function pull(remote = 'origin', branch?: string, token?: string): Promise<void> {
  const dir = getDir();
  const ref = branch ?? (await git.currentBranch({ fs, dir })) ?? 'main';
  const author = await getGitAuthorConfig();
  if (!isGitAuthorConfigured(author)) {
    throw new Error('Set your commit identity in Git > Changes before pulling, so any merge commit is attributed correctly.');
  }
  await git.pull({
    fs, http, dir, remote, ref,
    author,
    onAuth: token ? () => ({ username: 'x-access-token', password: token }) : undefined,
  });
}

export async function clone(url: string, token?: string): Promise<void> {
  const dir = getDir();
  await fs.promises.mkdir('/projects').catch(() => {});
  await git.clone({
    fs, http, dir, url,
    onAuth: token ? () => ({ username: 'x-access-token', password: token }) : undefined,
    singleBranch: true,
    depth: 10,
  });
}

export async function addRemote(name: string, url: string): Promise<void> {
  const dir = getDir();
  await git.addRemote({ fs, dir, remote: name, url });
}

export async function setRemote(name: string, url: string): Promise<void> {
  const dir = getDir();
  const remotes = await git.listRemotes({ fs, dir });
  if (remotes.some(remote => remote.remote === name)) {
    await git.setConfig({ fs, dir, path: `remote.${name}.url`, value: url });
    return;
  }
  await git.addRemote({ fs, dir, remote: name, url });
}

export async function listRemotes(): Promise<Array<{ remote: string; url: string }>> {
  const dir = getDir();
  return git.listRemotes({ fs, dir });
}

export async function readFile(filepath: string): Promise<string> {
  const dir = getDir();
  const raw = await fs.promises.readFile(`${dir}/${normalizeProjectPath(filepath)}`, { encoding: 'utf8' });
  return typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
}

export async function readFileBytes(filepath: string): Promise<Uint8Array> {
  const dir = getDir();
  const raw = await fs.promises.readFile(`${dir}/${normalizeProjectPath(filepath)}`);
  return typeof raw === 'string' ? new TextEncoder().encode(raw) : new Uint8Array(raw);
}

export async function writeFile(filepath: string, content: string): Promise<void> {
  const dir = getDir();
  const full = `${dir}/${normalizeProjectPath(filepath)}`;
  const parts = full.split('/');
  for (let i = 2; i < parts.length; i++) {
    const d = parts.slice(0, i).join('/');
    try { await fs.promises.mkdir(d); } catch {}
  }
  await fs.promises.writeFile(full, content, 'utf8');
}

export async function listFiles(subdir = ''): Promise<string[]> {
  const dir = getDir();
  const base = subdir ? `${dir}/${normalizeProjectPath(subdir)}` : dir;
  const recurse = async (p: string): Promise<string[]> => {
    const entries = await fs.promises.readdir(p);
    const results: string[] = [];
    for (const e of entries) {
      if (e === '.git') continue;
      const full = `${p}/${e}`;
      try {
        const stat = await fs.promises.stat(full);
        if ((stat as any).type === 'dir') results.push(...await recurse(full));
        else results.push(full.replace(`${dir}/`, ''));
      } catch {}
    }
    return results;
  };
  return recurse(base).catch(() => []);
}
