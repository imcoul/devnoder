import React, { lazy, Suspense, ComponentType } from 'react';

export { default as CommandPalette } from '../layout/CommandPalette';
export { default as BottomNav }      from '../layout/BottomNav';

// Sprints 1–8
export const CodePanel      = lazy(() => import('./CodePanel'));
export const VisualPanel    = lazy(() => import('./VisualPanel'));
export const TerminalPanel  = lazy(() => import('../terminal/TerminalPanel'));
export const GitPanel       = lazy(() => import('../git/GitPanel'));
export const AIPanel        = lazy(() => import('../ai/AIPanel'));
export const PreviewPanel   = lazy(() => import('../preview/PreviewPanel'));
export const CollabPanel    = lazy(() => import('../collab/CollabPanel'));
export const DocsPanel      = lazy(() => import('../docs/DocsPanel'));
export const APITesterPanel = lazy(() => import('../api/APITesterPanel'));
export const HealthPanel    = lazy(() => import('../health/HealthPanel'));

// Sprint 9
export const CommunityPanel = lazy(() => import('../community/CommunityPanel'));
export const PluginPanel    = lazy(() => import('../plugins/PluginPanel'));

// Sprint 10
export const SettingsPanel  = lazy(() => import('../settings/SettingsPanel'));
export const BillingPanel   = lazy(() => import('../settings/BillingPanel'));
export const AboutPanel     = lazy(() => import('../settings/AboutPanel'));

// Sprint 11
export const FeedbackPanel    = lazy(() => import('../ai/FeedbackPanel'));

// Sprint 12
export const MCPServerPanel   = lazy(() => import('../ai/MCPServerPanel'));

// Sprint 13
export const SkillsPanel      = lazy(() => import('../ai/SkillsPanel'));

export interface PanelMeta {
  id: string; label: string; icon: string;
  component: React.LazyExoticComponent<ComponentType<any>>;
  nav: boolean; shortcut?: string; sprint: number;
}

export const PANELS: PanelMeta[] = [
  { id: 'code',      label: 'Code Editor',    icon: '💻', component: CodePanel,      nav: true,  shortcut: '1', sprint: 1 },
  { id: 'visual',    label: 'Visual Editor',  icon: '🎨', component: VisualPanel,    nav: true,  shortcut: '2', sprint: 2 },
  { id: 'terminal',  label: 'Terminal',       icon: '⌨',  component: TerminalPanel,  nav: true,  shortcut: '3', sprint: 3 },
  { id: 'git',       label: 'Git & GitHub',   icon: '🔀', component: GitPanel,       nav: true,  shortcut: '4', sprint: 4 },
  { id: 'ai',        label: 'AI Assistant',   icon: '🤖', component: AIPanel,        nav: true,  shortcut: '5', sprint: 5 },
  { id: 'preview',   label: 'Live Preview',   icon: '👁',  component: PreviewPanel,   nav: false, shortcut: '6', sprint: 6 },
  { id: 'collab',    label: 'Collaborate',    icon: '👥', component: CollabPanel,    nav: false, shortcut: '7', sprint: 7 },
  { id: 'docs',      label: 'Documentation',  icon: '📚', component: DocsPanel,      nav: false, shortcut: '8', sprint: 8 },
  { id: 'api',       label: 'API Tester',     icon: '⚡', component: APITesterPanel, nav: false, shortcut: '9', sprint: 8 },
  { id: 'health',    label: 'Project Health', icon: '🏥', component: HealthPanel,    nav: false, shortcut: '0', sprint: 8 },
  { id: 'community', label: 'Community',      icon: '🌐', component: CommunityPanel, nav: false, sprint: 9 },
  { id: 'plugins',   label: 'Plugins',        icon: '🧩', component: PluginPanel,    nav: false, sprint: 9 },
  { id: 'settings',  label: 'Settings',       icon: '⚙',  component: SettingsPanel,  nav: false, sprint: 10 },
  { id: 'billing',   label: 'Billing',        icon: '⭐', component: BillingPanel,   nav: false, sprint: 10 },
  { id: 'about',     label: 'About',          icon: 'ℹ',  component: AboutPanel,     nav: false, sprint: 10 },
  { id: 'feedback',  label: 'AI Feedback',    icon: '📊', component: FeedbackPanel,  nav: false, sprint: 11 },
  { id: 'mcp',       label: 'MCP Servers',     icon: '🔌', component: MCPServerPanel, nav: false, sprint: 12 },
  { id: 'skills',    label: 'Skills',          icon: '⚡', component: SkillsPanel,    nav: false, sprint: 13 },
];

export function getPanelById(id: string) { return PANELS.find(p => p.id === id); }
export function getNavPanels() { return PANELS.filter(p => p.nav); }

function PanelFallback({ id }: { id: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      blockSize:'100%', color:'var(--color-text-muted)', fontSize:'0.85rem',
      flexDirection:'column', gap:'0.5rem' }}>
      <div style={{ width:'1.5rem', height:'1.5rem', border:'2px solid var(--color-border)',
        borderTopColor:'var(--color-turquoise)', borderRadius:'50%',
        animation:'spin 0.7s linear infinite' }} />
      <span>Loading {id}…</span>
    </div>
  );
}

export function PanelShell({ panelId }: { panelId: string }) {
  const meta = getPanelById(panelId);
  if (!meta) return <div style={{ padding:'1rem', color:'var(--color-text-muted)' }}>Unknown panel: {panelId}</div>;
  const Component = meta.component;
  return (
    <Suspense fallback={<PanelFallback id={meta.label} />}>
      <Component />
    </Suspense>
  );
}
