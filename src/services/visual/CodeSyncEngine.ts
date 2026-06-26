// CodeSyncEngine.ts — bidirectional GrapesJS ↔ CodeMirror sync
// Code is always the source of truth. Visual changes generate code, never vice versa directly.
import { bufferManager, $activeBuffer, $buffers } from '../editor/BufferManager';

export type SyncDirection = 'code-to-visual' | 'visual-to-code';

export interface SyncEvent {
  direction: SyncDirection;
  html?: string;
  css?: string;
  timestamp: number;
}

type SyncListener = (event: SyncEvent) => void;

class CodeSyncEngine {
  private listeners: SyncListener[] = [];
  private lastHtml = '';
  private lastCss = '';
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  on(listener: SyncListener) { this.listeners.push(listener); }
  off(listener: SyncListener) { this.listeners = this.listeners.filter(l => l !== listener); }

  private emit(event: SyncEvent) { this.listeners.forEach(l => l(event)); }

  /** Called when code buffer changes — push to visual */
  codeChanged(html: string, css: string) {
    if (html === this.lastHtml && css === this.lastCss) return;
    this.lastHtml = html;
    this.lastCss = css;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.emit({ direction: 'code-to-visual', html, css, timestamp: Date.now() });
    }, 400);
  }

  /** Called when GrapesJS editor changes — push back to code buffer */
  visualChanged(html: string, css: string) {
    if (html === this.lastHtml && css === this.lastCss) return;
    this.lastHtml = html;
    this.lastCss = css;

    // Write back into the active buffer
    const id = $activeBuffer.get();
    if (id) {
      const full = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8" />\n<style>\n${css}\n</style>\n</head>\n<body>\n${html}\n</body>\n</html>`;
      bufferManager.update(id, full);
    }

    this.emit({ direction: 'visual-to-code', html, css, timestamp: Date.now() });
  }

  /** Parse an HTML string into body HTML + style content */
  parse(fullHtml: string): { html: string; css: string } {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(fullHtml, 'text/html');
      const css = Array.from(doc.querySelectorAll('style'))
        .map(s => s.textContent ?? '').join('\n');
      doc.querySelectorAll('style, script').forEach(el => el.remove());
      return { html: doc.body.innerHTML.trim(), css: css.trim() };
    } catch {
      return { html: fullHtml, css: '' };
    }
  }
}

export const codeSyncEngine = new CodeSyncEngine();
