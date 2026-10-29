import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $activePanel, $theme, setPanel } from './stores/ui';
import { PanelShell } from './components/panels';
import BottomNav from './components/layout/BottomNav';
import CommandPalette from './components/layout/CommandPalette';
import ToastContainer from './components/layout/ToastContainer';
import InstallPrompt from './components/layout/InstallPrompt';
import OfflineBanner from './components/layout/OfflineBanner';
import WorkspaceHeader from './components/layout/WorkspaceHeader';
import { audioCueService } from './services/accessibility/AudioCueService';
import { projectService } from './services/project/ProjectService';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initSentry } from './services/observability/Sentry';

export default function App() {
  const activePanel = useStore($activePanel);
  const theme       = useStore($theme);
  const [checkingProjects, setCheckingProjects] = useState(true);
  const [startupError, setStartupError] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    initSentry(import.meta.env.VITE_SENTRY_DSN);
  }, []);

  useEffect(() => {
    // First-run gate: if no project has ever been created, land on the
    // onboarding panel. Otherwise resume whichever project was last active —
    // GitService's active-project pointer is in-memory only and resets on
    // every reload, so without this every reload would silently land in a
    // nonexistent "default" directory instead of the user's real project.
    projectService.resumeLastProject().then(resumed => {
      if (!resumed) setPanel('onboarding');
      setCheckingProjects(false);
    }).catch((error: unknown) => {
      setStartupError(error instanceof Error ? error.message : 'Projects could not be loaded. You can retry or start a new local project.');
      setPanel('onboarding');
      setCheckingProjects(false);
    });
  }, []);

  useEffect(() => {
    audioCueService.load();
  }, []);

  useEffect(() => {
    // Announce panel switch to screen reader / audio cue users, and actually
    // move DOM focus there — the announcement alone doesn't help keyboard
    // users, whose focus previously stayed wherever it was on the old panel.
    const label = activePanel.charAt(0).toUpperCase() + activePanel.slice(1);
    audioCueService.announcePanel(label);
    mainRef.current?.focus();
  }, [activePanel]);

  useEffect(() => {
    // Wire the real filesystem into services that were defined to accept
    // one via setFS() but never actually got called — health metrics were
    // silently fabricated instead of reporting "unavailable" as a result.
    Promise.all([
      import('./services/git/GitService'),
      import('./services/health/ProjectHealthService'),
    ]).then(([{ fs }, { projectHealthService }]) => {
      projectHealthService.setFS(fs);
    }).catch(console.warn);

    // Sprint 8 — seed built-in snippets
    import('./services/snippets/SnippetService')
      .then(m => m.snippetService.init())
      .catch(console.warn);

    // Sprint 9 — restore saved community theme tokens
    import('./services/community/ThemeRegistry')
      .then(m => m.themeRegistry.reapplySaved())
      .catch(console.warn);

    // Sprint 13 — seed built-in skills
    import('./services/ai/BuiltinSkills')
      .then(m => m.seedBuiltinSkills())
      .catch(console.warn);

    // Sprint 12 — connect enabled MCP servers
    import('./services/ai/MCPClient')
      .then(m => m.mcpClient.connectAll())
      .catch(console.warn);

    // Sprint 10 — load subscription tier
    import('./services/cloud/CloudTier')
      .then(m => { m.loadSubscription(); m.handleBillingCallback(); })
      .catch(console.warn);

    // Health-check the executor Worker instead of hardcoding "unavailable" —
    // reports false honestly until the Worker is actually deployed.
    import('./services/terminal/CloudExecutor')
      .then(m => m.cloudExecutor.checkAvailability())
      .catch(console.warn);
  }, []);

  useEffect(() => {
    // Register SW and request push permission (Sprint 0 / SW push)
    if ('serviceWorker' in navigator && 'Notification' in window) {
      navigator.serviceWorker.ready.then(reg => {
        // Only request after user gesture — we store intent, request on first AI send
        const stored = localStorage.getItem('devnoder-push-permission');
        if (stored === 'granted' && reg.pushManager) {
          // Already granted — subscribe silently
          reg.pushManager.getSubscription().catch(() => {});
        }
      }).catch(() => {});
    }
  }, []);

  if (checkingProjects) {
    return <div className="app-root" aria-busy="true">
      <WorkspaceHeader />
      <main style={{ margin: 'auto', padding: '2rem', textAlign: 'center' }}>
        <p role="status">Opening this browser's workspace…</p>
        <p style={{ color: 'var(--color-text-muted)' }}>Your existing project files are not being cleared.</p>
        <button type="button" onClick={() => window.location.reload()} style={{ minHeight: 44, padding: '.6rem 1rem' }}>Retry opening workspace</button>
      </main>
    </div>;
  }

  return (
    <ErrorBoundary>
      <div className="app-root">
        <WorkspaceHeader />
        {startupError && (
          <div className="app-startup-error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--color-surface)', borderBlockEnd: '1px solid var(--color-error)', color: 'var(--color-text)' }}>
            <span>{startupError}</span>
            <button type="button" onClick={() => window.location.reload()} style={{ minBlockSize: '2.5rem', padding: '0.4rem 0.7rem', border: '1px solid var(--color-turquoise)', borderRadius: 'var(--radius)', background: 'transparent', color: 'var(--color-turquoise)' }}>Retry</button>
          </div>
        )}
        <main className="app-main" ref={mainRef} tabIndex={-1}>
          <PanelShell panelId={activePanel} />
        </main>
        {activePanel !== 'onboarding' && <BottomNav />}
        <CommandPalette />
        <ToastContainer />
        <InstallPrompt />
        <OfflineBanner />
      </div>
    </ErrorBoundary>
  );
}
