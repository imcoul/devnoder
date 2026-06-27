// GitService.ts — isomorphic-git + lightning-fs, full offline
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import FS from '@isomorphic-git/lightning-fs';

export const fs = new FS('devnoder-fs');
export const dir = '/devnoder';

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

// Init or open repo
export async function initRepo(): Promise<void> {
  try {
    await git.resolveRef({ fs, dir, ref: 'HEAD' });
  } catch {
    await fs.promises.mkdir(dir).catch(() => {});
    await git.init({ fs, dir, defaultBranch: 'main' });
    await git.setConfig({ fs, dir, path: 'user.name',  value: 'DevNoder User' });
    await git.setConfig({ fs, dir, path: 'user.email', value: 'dev@srvel.io' });
  }
}

export async function getStatus(): Promise<FileStatus[]> {
  const matrix = await git.statusMatrix({ fs, dir });
  return matrix
    .filter(([, head, workdir, stage]) => !(head === 1 && workdir === 1 && stage === 1))
    .map(([path, head, workdir, stage]) => {
      let status: FileStatus['status'];
      if (head === 0 && workdir === 2) status = 'untracked';
      else if (head === 1 && workdir === 2) status = 'modified';
      else if (head === 0 && workdir === 2 && stage === 2) status = 'added';
      else if (head === 1 && workdir === 0) status = 'deleted';
      else status = 'unmodified';
      return { path: String(path), status, staged: stage === 2 || stage === 3 };
    });
}

export async function stageFile(filepath: string): Promise<void> {
  await git.add({ fs, dir, filepath });
}

export async function unstageFile(filepath: string): Promise<void> {
  await git.resetIndex({ fs, dir, filepath });
}

export async function stageAll(): Promise<void> {
  const status = await getStatus();
  for (const f of status) {
    if (f.status !== 'unmodified') await git.add({ fs, dir, filepath: f.path });
  }
}

export async function commit(message: string): Promise<string> {
  // cue fired by GitPanel after success/error
  return git.commit({ fs, dir, message,
    author: {
      name:  await git.getConfig({ fs, dir, path: 'user.name'  }) ?? 'DevNoder User',
      email: await git.getConfig({ fs, dir, path: 'user.email' }) ?? 'dev@srvel.io',
    },
  });
}

export async function getLog(depth = 20): Promise<CommitEntry[]> {
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
  const [local, current] = await Promise.all([
    git.listBranches({ fs, dir }),
    git.currentBranch({ fs, dir }),
  ]);
  return local.map(name => ({ name, current: name === current }));
}

export async function createBranch(name: string): Promise<void> {
  await git.branch({ fs, dir, ref: name });
}

export async function checkoutBranch(name: string): Promise<void> {
  await git.checkout({ fs, dir, ref: name });
}

export async function deleteBranch(name: string): Promise<void> {
  await git.deleteBranch({ fs, dir, ref: name });
}

export async function push(remote = 'origin', branch?: string, token?: string): Promise<void> {
  const ref = branch ?? (await git.currentBranch({ fs, dir })) ?? 'main';
  await git.push({
    fs, http, dir, remote, ref,
    onAuth: token ? () => ({ username: token }) : undefined,
  });
}

export async function pull(remote = 'origin', branch?: string, token?: string): Promise<void> {
  const ref = branch ?? (await git.currentBranch({ fs, dir })) ?? 'main';
  await git.pull({
    fs, http, dir, remote, ref,
    author: { name: 'DevNoder User', email: 'dev@srvel.io' },
    onAuth: token ? () => ({ username: token }) : undefined,
  });
}

export async function clone(url: string, token?: string): Promise<void> {
  await git.clone({
    fs, http, dir, url,
    onAuth: token ? () => ({ username: token }) : undefined,
    singleBranch: true,
    depth: 10,
  });
}

export async function addRemote(name: string, url: string): Promise<void> {
  await git.addRemote({ fs, dir, remote: name, url });
}

export async function readFile(filepath: string): Promise<string> {
  const raw = await fs.promises.readFile(`${dir}/${filepath}`, { encoding: 'utf8' });
  return typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
}

export async function writeFile(filepath: string, content: string): Promise<void> {
  const full = `${dir}/${filepath}`;
  const parts = full.split('/');
  for (let i = 2; i < parts.length; i++) {
    const d = parts.slice(0, i).join('/');
    try { await fs.promises.mkdir(d); } catch {}
  }
  await fs.promises.writeFile(full, content, 'utf8');
}

export async function listFiles(subdir = ''): Promise<string[]> {
  const base = subdir ? `${dir}/${subdir}` : dir;
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
