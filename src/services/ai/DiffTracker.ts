// DiffTracker.ts — tracks file changes since last AI message
import { $buffers } from '../editor/BufferManager';

interface Snapshot { path: string; content: string; }

class DiffTracker {
  private snapshots = new Map<string, Snapshot>();

  snapshot() {
    for (const buf of $buffers.get()) {
      this.snapshots.set(buf.path, { path: buf.path, content: buf.content });
    }
  }

  getDiff(): string {
    const lines: string[] = [];
    for (const buf of $buffers.get()) {
      const prev = this.snapshots.get(buf.path);
      if (!prev) {
        lines.push(`[NEW FILE] ${buf.path}`);
        continue;
      }
      if (prev.content !== buf.content) {
        const prevLines = prev.content.split('\n');
        const currLines = buf.content.split('\n');
        lines.push(`[MODIFIED] ${buf.path}`);
        // Simple line-level diff (first 20 changed lines)
        let shown = 0;
        for (let i = 0; i < Math.max(prevLines.length, currLines.length) && shown < 20; i++) {
          if (prevLines[i] !== currLines[i]) {
            if (prevLines[i] !== undefined) lines.push(`- ${prevLines[i]}`);
            if (currLines[i] !== undefined) lines.push(`+ ${currLines[i]}`);
            shown++;
          }
        }
      }
    }
    return lines.join('\n');
  }

  clear() { this.snapshots.clear(); }
}

export const diffTracker = new DiffTracker();
