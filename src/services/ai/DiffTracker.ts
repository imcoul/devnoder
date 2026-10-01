// DiffTracker.ts — tracks file changes since last AI message
import { $buffers } from '../editor/BufferManager';
import { createPatch as jsCreatePatch } from 'jsdiff';

interface Snapshot { path: string; content: string; }

class DiffTracker {
  private snapshots = new Map<string, Snapshot>();

  snapshot() {
    for (const buf of $buffers.get()) {
      this.snapshots.set(buf.path, { path: buf.path, content: buf.content });
    }
  }

  getDiff(path?: string): string {
    if (path) {
      const prev = this.snapshots.get(path);
      const buf = $buffers.get().find(b => b.path === path);
      if (!prev || !buf) return '';
      return jsCreatePatch(path, prev.content, buf.content, 'previous', 'current', { context: 3 });
    }

    const lines: string[] = [];
    for (const buf of $buffers.get()) {
      const prev = this.snapshots.get(buf.path);
      if (!prev) {
        lines.push(`[NEW FILE] ${buf.path}`);
        continue;
      }
      if (prev.content !== buf.content) {
        const patch = jsCreatePatch(buf.path, prev.content, buf.content, 'previous', 'current', { context: 3 });
        lines.push(patch);
      }
    }
    return lines.join('\n\n');
  }

  getDiffForPath(path: string): { old: string; new: string; patch: string } | null {
    const prev = this.snapshots.get(path);
    const buf = $buffers.get().find(b => b.path === path);
    if (!prev || !buf) return null;
    return {
      old: prev.content,
      new: buf.content,
      patch: jsCreatePatch(path, prev.content, buf.content, 'previous', 'current', { context: 3 }),
    };
  }

  clear() { this.snapshots.clear(); }
}

export const diffTracker = new DiffTracker();
