// VirtualFS.ts — unified filesystem abstraction for project files.
//
// Problem: file content lives in two places:
//   1. lightning-fs working tree (used by isomorphic-git)
//   2. IndexedDB via Dexie (used by BufferManager)
//   They drift, causing "file not found" and stale content bugs.
//
// Solution: single entry point for all file operations.
//   - Write goes to lightning-fs first (git needs it), then IndexedDB (editor needs it)
//   - Read checks IndexedDB first (faster), falls back to lightning-fs
//   - All mutations emit change events for sync, RAG, AI

import FS from '@isomorphic-git/lightning-fs';
import { db } from '../storage/db';

type ChangeType = 'write' | 'delete' | 'mkdir';
type ChangeListener = (event: { type: ChangeType; path: string; content?: string }) => void;

export class VirtualFS {
  private fs: FS;
  private projectId: string;
  private listeners: ChangeListener[] = [];
  private memoryCache = new Map<string, string>();

  constructor(projectId: string) {
    this.projectId = projectId;
    this.fs = new FS(`devnoder-fs-${projectId}`);
  }

  getGitDir(): string {
    return `/projects/${this.projectId}`;
  }

  getLightningFS(): FS {
    return this.fs;
  }

  async readFile(path: string): Promise<string> {
    const fullPath = this.resolve(path);

    // Check memory cache first
    if (this.memoryCache.has(fullPath)) {
      return this.memoryCache.get(fullPath)!;
    }

    // Check IndexedDB
    const record = await db.files.get({ projectId: this.projectId, path });
    if (record) {
      this.memoryCache.set(fullPath, record.content);
      return record.content;
    }

    // Fallback to lightning-fs
    try {
      const content = await this.fs.promises.readFile(fullPath, 'utf8');
      this.memoryCache.set(fullPath, content);
      return content;
    } catch {
      throw new Error(`File not found: ${path}`);
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    const fullPath = this.resolve(path);

    // Ensure directory exists
    await this.ensureDir(fullPath);

    // Write to lightning-fs (for git)
    await this.fs.promises.writeFile(fullPath, content, 'utf8');

    // Write to IndexedDB (for editor)
    await db.files.put({
      projectId: this.projectId,
      path,
      content,
      language: this.detectLanguage(path),
      updatedAt: Date.now(),
    });

    // Update cache
    this.memoryCache.set(fullPath, content);

    // Emit change
    this.emit('write', path, content);
  }

  async deleteFile(path: string): Promise<void> {
    const fullPath = this.resolve(path);

    // Delete from lightning-fs
    await this.fs.promises.unlink(fullPath).catch(() => {});

    // Delete from IndexedDB
    await db.files.delete({ projectId: this.projectId, path });

    // Remove from cache
    this.memoryCache.delete(fullPath);

    // Emit change
    this.emit('delete', path);
  }

  async listFiles(dir = ''): Promise<string[]> {
    const fullDir = this.resolve(dir);

    // Get files from lightning-fs
    const fsFiles = await this.recurse(fullDir);

    // Get files from IndexedDB
    const dbRecords = await db.files.where('projectId').equals(this.projectId).toArray();

    // Merge and deduplicate
    const all = new Set([...fsFiles, ...dbRecords.map((f: { path: string }) => f.path)]);
    return Array.from(all);
  }

  onChange(listener: ChangeListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  clearCache() {
    this.memoryCache.clear();
  }

  private resolve(path: string): string {
    return `/projects/${this.projectId}/${path}`;
  }

  private async ensureDir(filePath: string): Promise<void> {
    const parts = filePath.split('/');
    for (let i = 2; i < parts.length; i++) {
      const dir = parts.slice(0, i).join('/');
      try {
        await this.fs.promises.mkdir(dir);
      } catch {
        // Directory already exists
      }
    }
  }

  private async recurse(dir: string): Promise<string[]> {
    try {
      const entries = await this.fs.promises.readdir(dir);
      const results: string[] = [];
      for (const entry of entries) {
        const fullPath = `${dir}/${entry}`;
        try {
          const stat = await this.fs.promises.stat(fullPath);
          if ((stat as any).type === 'dir') {
            results.push(...await this.recurse(fullPath));
          } else {
            results.push(fullPath.replace(`/projects/${this.projectId}/`, ''));
          }
        } catch {
          // Skip inaccessible entries
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  private emit(type: ChangeType, path: string, content?: string) {
    this.listeners.forEach(l => l({ type, path, content }));
  }

  private detectLanguage(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = {
      ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
      html: 'html', css: 'css', json: 'json', md: 'markdown',
      py: 'python', rs: 'rust', cpp: 'cpp', c: 'c', sql: 'sql',
      yaml: 'yaml', yml: 'yaml', toml: 'toml', sh: 'bash',
      dart: 'dart', php: 'php', rb: 'ruby', xml: 'xml',
    };
    return map[ext] ?? 'plaintext';
  }
}

export function createVirtualFS(projectId: string): VirtualFS {
  return new VirtualFS(projectId);
}
