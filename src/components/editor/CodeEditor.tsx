import React, { useEffect, useRef, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { EditorState, Compartment, Extension, StateEffect } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, dropCursor, rectangularSelection, crosshairCursor } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { indentOnInput, bracketMatching, foldGutter, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { $buffers, $activeBuffer, bufferManager } from '../../services/editor/BufferManager';
import { $theme } from '../../stores/ui';
import { $ui } from '../../stores/ui';
import { loadLanguage, LangId } from './languages';
import { THEME_HIGHLIGHTS } from './theme';
import { detectSecrets } from '../../services/security/SecretDetector';

const langCompartment   = new Compartment();
const themeCompartment  = new Compartment();
const tabCompartment    = new Compartment();
const wrapCompartment   = new Compartment();

function baseExtensions(fontSize: number): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLine(),
    history(),
    foldGutter(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    dropCursor(),
    rectangularSelection(),
    crosshairCursor(),
    keymap.of([...defaultKeymap, ...historyKeymap, ...closeBracketsKeymap, indentWithTab]),
    EditorView.theme({
      '&': { height: '100%', fontSize: `${fontSize}px` },
      '.cm-scroller': { fontFamily: 'var(--font-code)', overflow: 'auto', height: '100%' },
      '.cm-content': { caretColor: 'var(--color-turquoise)', paddingBlock: '0.5rem' },
      '.cm-cursor': { borderLeftColor: 'var(--color-turquoise)', borderLeftWidth: '2px' },
      '.cm-activeLine': { backgroundColor: '#ffffff08' },
      '.cm-activeLineGutter': { backgroundColor: '#ffffff08' },
      '.cm-gutters': { background: 'var(--color-canvas)', borderRight: '1px solid var(--color-border)', color: 'var(--color-text-muted)' },
      '.cm-lineNumbers .cm-gutterElement': { paddingInline: '0.5rem 0.75rem', minWidth: '2.5rem' },
      '.cm-selectionBackground, ::selection': { backgroundColor: '#40E0D030 !important' },
      '.cm-foldPlaceholder': { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '3px' },
    }),
  ];
}

export default function CodeEditor() {
  const editorRef   = useRef<HTMLDivElement>(null);
  const viewRef     = useRef<EditorView | null>(null);
  const activeId    = useStore($activeBuffer);
  const buffers     = useStore($buffers);
  const theme       = useStore($theme);
  const ui          = useStore($ui);
  const lastIdRef   = useRef<string | null>(null);

  const activeBuffer = buffers.find(b => b.id === activeId);

  // ── Init editor ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!editorRef.current || viewRef.current) return;

    const state = EditorState.create({
      doc: '',
      extensions: [
        ...baseExtensions(ui.fontSize),
        langCompartment.of([]),
        themeCompartment.of(THEME_HIGHLIGHTS[theme] ?? THEME_HIGHLIGHTS['default']),
        tabCompartment.of(EditorState.tabSize.of(ui.tabSize)),
        wrapCompartment.of(ui.wordWrap ? EditorView.lineWrapping : []),
        EditorView.updateListener.of(update => {
          if (!update.docChanged) return;
          const id = $activeBuffer.get();
          if (!id) return;
          const content = update.state.doc.toString();
          bufferManager.update(id, content);
          // Secret detection (debounced via requestIdleCallback)
          if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(() => {
              const buf = $buffers.get().find(b => b.id === id);
              if (buf) {
              const findings = detectSecrets(content, buf.filename);
              if (findings.length > 0) {
                import('../../services/accessibility/AudioCueService')
                  .then(m => m.audioCueService.cue('secret-detected',
                    `Warning: ${findings.length} secret${findings.length>1?'s':''} detected`))
                  .catch(() => {});
              }
            }
            });
          }
        }),
      ],
    });

    viewRef.current = new EditorView({ state, parent: editorRef.current });

    return () => { viewRef.current?.destroy(); viewRef.current = null; };
  }, []);

  // ── Swap buffer content ────────────────────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !activeBuffer) return;
    if (activeId === lastIdRef.current) return;
    lastIdRef.current = activeId;

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: activeBuffer.content },
      selection: { anchor: 0 },
    });
    view.scrollDOM.scrollTop = activeBuffer.scrollTop;

    // Swap language
    loadLanguage(activeBuffer.language as LangId).then(lang => {
      view.dispatch({ effects: langCompartment.reconfigure(lang ? [lang] : []) });
    });
  }, [activeId, activeBuffer]);

  // ── Hot-swap theme ─────────────────────────────────────────────────────────
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: themeCompartment.reconfigure(THEME_HIGHLIGHTS[theme] ?? THEME_HIGHLIGHTS['default']),
    });
  }, [theme]);

  // ── Hot-swap tab size ──────────────────────────────────────────────────────
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: tabCompartment.reconfigure(EditorState.tabSize.of(ui.tabSize)),
    });
  }, [ui.tabSize]);

  // ── Hot-swap word wrap ─────────────────────────────────────────────────────
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: wrapCompartment.reconfigure(ui.wordWrap ? EditorView.lineWrapping : []),
    });
  }, [ui.wordWrap]);

  // ── Yjs collaboration binding ─────────────────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    let cleanup: (() => void) | undefined;

    import('../../services/collab/CollabService').then(async ({ collabService }) => {
      const yText = collabService.getSharedText('code');
      const session = collabService.getSession();
      if (!yText || !session?.awareness) return;

      const { bindYjsCollaboration } = await import('./CodeEditor');
      cleanup = await bindYjsCollaboration(view, yText, session.awareness);
    }).catch(() => {});

    return () => { cleanup?.(); };
  }, [activeId]); // re-bind when active buffer changes

  // ── Touch: swipe left/right to change buffer ───────────────────────────────
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > Math.abs(dy) * 2 && Math.abs(dx) > 60) {
      dx < 0 ? bufferManager.swipeNext() : bufferManager.swipePrev();
    }
    touchStart.current = null;
  };

  if (!activeBuffer) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        blockSize: '100%', flexDirection: 'column', gap: '0.5rem',
        color: 'var(--color-text-muted)', fontSize: '0.9rem',
      }}>
        <span style={{ fontSize: '2rem' }}>💻</span>
        <p>No file open</p>
        <p style={{ fontSize: '0.75rem' }}>Open a file from the Git panel or create one</p>
      </div>
    );
  }

  return (
    <div style={{ blockSize: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', overflowX: 'auto', background: 'var(--color-surface)',
        borderBlockEnd: '1px solid var(--color-border)', flexShrink: 0,
      }}>
        {buffers.map(buf => (
          <div key={buf.id} style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem',
            padding: '0.35rem 0.75rem', cursor: 'pointer', whiteSpace: 'nowrap',
            borderInlineEnd: '1px solid var(--color-border)', fontSize: '0.78rem',
            background: buf.id === activeId ? 'var(--color-canvas)' : 'transparent',
            color: buf.id === activeId ? 'var(--color-text)' : 'var(--color-text-muted)',
          }} onClick={() => bufferManager.open(buf.path, buf.content, buf.language)}>
            {buf.dirty && <span style={{ color: 'var(--color-warn)', fontSize: '0.6rem' }}>●</span>}
            {buf.filename}
            <span style={{ cursor: 'pointer', opacity: 0.5, marginInlineStart: '0.2rem' }}
              onClick={e => { e.stopPropagation(); bufferManager.close(buf.id); }}>×</span>
          </div>
        ))}
      </div>
      {/* Editor */}
      <div ref={editorRef} style={{ flex: 1, overflow: 'hidden' }}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} />
    </div>
  );
}

// ── Yjs collaboration binding (Sprint 7) ──────────────────────────────────────
// Called externally when CollabService has a live session
export async function bindYjsCollaboration(view: EditorView, yText: any, awareness: any): Promise<() => void> {
  const { yCollab } = await import('y-codemirror.next');
  const { UndoManager } = await import('yjs');
  const undoManager = new UndoManager(yText);
  const binding = yCollab(yText, awareness, { undoManager });
  const ext = view.state.update({ effects: StateEffect.appendConfig.of([binding]) });
  view.dispatch(ext);
  return () => (binding as any).destroy?.();
}
