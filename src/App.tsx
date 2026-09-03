import React, { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $activePanel, $theme, setPanel } from './stores/ui';
import { PanelShell } from './components/panels';
import BottomNav from './components/layout/BottomNav';
import CommandPalette from './components/layout/CommandPalette';
import ToastContainer from './components/layout/ToastContainer';
import { audioCueService } from './services/accessibility/AudioCueService';
import { projectService } from './services/project/ProjectService';

export default function App() {
  const activePanel = useStore($activePanel);
  const theme       = useStore($theme);
  const [checkingProjects, setCheckingProjects] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    // First-run gate: if no project has ever been created, land on the
    // onboarding panel instead of a Code editor with nothing to edit.
    projectService.hasAnyProject().then(has => {
      if (!has) setPanel('onboarding');
      setCheckingProjects(false);
    }).catch(() => setCheckingProjects(false));
  }, []);

  useEffect(() => {
    audioCueService.load();
  }, []);

  useEffect(() => {
    // Announce panel switch to screen reader / audio cue users
    const label = activePanel.charAt(0).toUpperCase() + activePanel.slice(1);
    audioCueService.announcePanel(label);
  }, [activePanel]);

  useEffect(() => {
    // Sprint 8 — seed built-in snippets
    import('./services/snippets/SnippetService')
      .then(m => m.snippetService.init())
      .catch(console.warn);

    // Sprint 9 — restore saved community theme tokens
    import('./services/community/ThemeRegistry')
      .then(m => m.themeRegistry.reapplySaved())
      .catch(console.warn);

    // Sprint 14 — pre-load embedding model (background, non-blocking)
    import('./services/ai/EmbeddingEngine')
      .then(m => m.embeddingEngine.loadModel())
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
    return <div className="app-root" aria-busy="true" />;
  }

  return (
    <div className="app-root">
      <main className="app-main">
        <PanelShell panelId={activePanel} />
      </main>
      {activePanel !== 'onboarding' && <BottomNav />}
      <CommandPalette />
      <ToastContainer />
    </div>
  );
}
