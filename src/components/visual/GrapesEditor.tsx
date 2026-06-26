import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $buffers, $activeBuffer } from '../../services/editor/BufferManager';
import { codeSyncEngine } from '../../services/visual/CodeSyncEngine';
import { checkAccessibility, A11yIssue } from '../../services/visual/AccessibilityChecker';
import './GrapesEditor.css';

export default function GrapesEditor() {
  const editorRef  = useRef<HTMLDivElement>(null);
  const gjsRef     = useRef<any>(null);
  const activeId   = useStore($activeBuffer);
  const buffers    = useStore($buffers);
  const [issues, setIssues]     = useState<A11yIssue[]>([]);
  const [breakpoint, setBreakpoint] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [showA11y, setShowA11y] = useState(false);

  const activeBuffer = buffers.find(b => b.id === activeId);

  useEffect(() => {
    if (!editorRef.current) return;
    let gjs: any;

    import('grapesjs').then(({ default: grapesjs }) => {
      import('grapesjs-preset-webpage').then(({ default: webpagePlugin }) => {
        gjs = grapesjs.init({
          container: editorRef.current!,
          fromElement: false,
          storageManager: false,
          plugins: [webpagePlugin],
          pluginsOpts: { [(webpagePlugin as unknown) as string]: {} },
          deviceManager: {
            devices: [
              { name: 'Desktop', width: '' },
              { name: 'Tablet',  width: '768px' },
              { name: 'Mobile',  width: '390px' },
            ],
          },
          canvas: { styles: ['https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap'] },
        });

        gjsRef.current = gjs;

        // Load initial content
        if (activeBuffer) {
          const { html, css } = codeSyncEngine.parse(activeBuffer.content);
          gjs.setComponents(html);
          gjs.setStyle(css);
        }

        // Visual → code
        gjs.on('component:update style:change', () => {
          const html = gjs.getHtml();
          const css  = gjs.getCss();
          codeSyncEngine.visualChanged(html ?? '', css ?? '');
          setIssues(checkAccessibility(html ?? ''));
        });
      });
    });

    // Code → visual
    const syncListener = codeSyncEngine.on.bind(codeSyncEngine);
    const handler = (e: any) => {
      if (e.direction === 'code-to-visual' && gjsRef.current) {
        gjsRef.current.setComponents(e.html ?? '');
        gjsRef.current.setStyle(e.css ?? '');
      }
    };
    codeSyncEngine.on(handler);

    return () => {
      codeSyncEngine.off(handler);
      gjs?.destroy();
      gjsRef.current = null;
    };
  }, []);

  // Push code changes to visual when buffer changes externally
  useEffect(() => {
    if (!activeBuffer || !gjsRef.current) return;
    const { html, css } = codeSyncEngine.parse(activeBuffer.content);
    codeSyncEngine.codeChanged(html, css);
  }, [activeBuffer?.content]);

  const setDevice = (bp: typeof breakpoint) => {
    setBreakpoint(bp);
    const deviceMap = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' };
    gjsRef.current?.setDevice(deviceMap[bp]);
  };

  return (
    <div className="grapes-wrap">
      <div className="grapes-toolbar">
        {(['desktop', 'tablet', 'mobile'] as const).map(bp => (
          <button key={bp} className={`bp-btn ${breakpoint === bp ? 'active' : ''}`}
            onClick={() => setDevice(bp)} aria-label={`${bp} view`}>
            {bp === 'desktop' ? '🖥' : bp === 'tablet' ? '📱' : '📲'}
          </button>
        ))}
        <div className="grapes-spacer" />
        <button className={`a11y-btn ${showA11y ? 'active' : ''} ${issues.filter(i => i.severity === 'error').length ? 'has-errors' : ''}`}
          onClick={() => setShowA11y(s => !s)}>
          ♿ {issues.length > 0 ? issues.length : '✓'}
        </button>
      </div>
      <div className="grapes-main">
        <div ref={editorRef} className="grapes-container" />
        {showA11y && (
          <div className="a11y-panel">
            <div className="a11y-head">
              <span>Accessibility ({issues.length} issues)</span>
              <button onClick={() => setShowA11y(false)}>×</button>
            </div>
            <div className="a11y-list">
              {issues.length === 0 && <p className="a11y-ok">✅ No issues found</p>}
              {issues.map((iss, i) => (
                <div key={i} className={`a11y-issue a11y-issue--${iss.severity}`}>
                  <span className="a11y-rule">{iss.rule}</span>
                  <span className="a11y-wcag">WCAG {iss.wcag}</span>
                  <p className="a11y-msg">{iss.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
