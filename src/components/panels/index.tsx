import React, { lazy, Suspense, ComponentType } from 'react';

export { default as CommandPalette } from '../layout/CommandPalette';
export { default as BottomNav } from '../layout/BottomNav';
export const OnboardingPanel = lazy(() => import('../onboarding/OnboardingPanel'));
export const CodePanel = lazy(() => import('./CodePanel'));
export const VisualPanel = lazy(() => import('./VisualPanel'));
export const TerminalPanel = lazy(() => import('../terminal/TerminalPanel'));
export const GitPanel = lazy(() => import('../git/GitPanel'));
export const AIPanel = lazy(() => import('../ai/AIPanel'));
export const PreviewPanel = lazy(() => import('../preview/PreviewPanel'));
export const CollabPanel = lazy(() => import('../collab/CollabPanel'));
export const DocsPanel = lazy(() => import('../docs/DocsPanel'));
export const APITesterPanel = lazy(() => import('../api/APITesterPanel'));
export const HealthPanel = lazy(() => import('../health/HealthPanel'));
export const CommunityPanel = lazy(() => import('../community/CommunityPanel'));
export const PluginPanel = lazy(() => import('../plugins/PluginPanel'));
export const SettingsPanel = lazy(() => import('../settings/SettingsPanel'));
export const BillingPanel = lazy(() => import('../settings/BillingPanel'));
export const AboutPanel = lazy(() => import('../settings/AboutPanel'));
export const FeedbackPanel = lazy(() => import('../ai/FeedbackPanel'));
export const MCPServerPanel = lazy(() => import('../ai/MCPServerPanel'));
export const SkillsPanel = lazy(() => import('../ai/SkillsPanel'));

export interface PanelMeta { id: string; label: string; icon: string; component: React.LazyExoticComponent<ComponentType<any>>; nav: boolean; shortcut?: string; sprint: number; }

export const PANELS: PanelMeta[] = [
  { id: 'onboarding', label: 'Projects', icon: 'projects', component: OnboardingPanel, nav: false, sprint: 0 },
  { id: 'code', label: 'Code', icon: 'code', component: CodePanel, nav: true, shortcut: '1', sprint: 1 },
  { id: 'visual', label: 'Visual', icon: 'visual', component: VisualPanel, nav: false, shortcut: '2', sprint: 2 },
  { id: 'terminal', label: 'Terminal', icon: 'terminal', component: TerminalPanel, nav: false, shortcut: '3', sprint: 3 },
  { id: 'git', label: 'Git', icon: 'git', component: GitPanel, nav: true, shortcut: '4', sprint: 4 },
  { id: 'ai', label: 'AI', icon: 'ai', component: AIPanel, nav: true, shortcut: '5', sprint: 5 },
  { id: 'preview', label: 'Preview', icon: 'preview', component: PreviewPanel, nav: true, shortcut: '6', sprint: 6 },
  { id: 'collab', label: 'Collaborate', icon: 'more', component: CollabPanel, nav: false, shortcut: '7', sprint: 7 },
  { id: 'docs', label: 'Docs', icon: 'docs', component: DocsPanel, nav: false, shortcut: '8', sprint: 8 },
  { id: 'api', label: 'API Tester', icon: 'more', component: APITesterPanel, nav: false, shortcut: '9', sprint: 8 },
  { id: 'health', label: 'Project Health', icon: 'more', component: HealthPanel, nav: false, shortcut: '0', sprint: 8 },
  { id: 'community', label: 'Community', icon: 'more', component: CommunityPanel, nav: false, sprint: 9 },
  { id: 'plugins', label: 'Plugins', icon: 'more', component: PluginPanel, nav: false, sprint: 9 },
  { id: 'settings', label: 'Settings', icon: 'settings', component: SettingsPanel, nav: false, sprint: 10 },
  { id: 'billing', label: 'Billing', icon: 'more', component: BillingPanel, nav: false, sprint: 10 },
  { id: 'about', label: 'About', icon: 'about', component: AboutPanel, nav: false, sprint: 10 },
  { id: 'feedback', label: 'AI Feedback', icon: 'more', component: FeedbackPanel, nav: false, sprint: 11 },
  { id: 'mcp', label: 'MCP Servers', icon: 'more', component: MCPServerPanel, nav: false, sprint: 12 },
  { id: 'skills', label: 'Skills', icon: 'more', component: SkillsPanel, nav: false, sprint: 13 },
];

export function getPanelById(id: string) { return PANELS.find(panel => panel.id === id); }
export function getNavPanels() { return PANELS.filter(panel => panel.nav); }

function PanelFallback({ id }: { id: string }) { return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', blockSize: '100%', color: 'var(--color-text-muted)', fontSize: '.85rem' }} aria-busy="true">Loading {id}…</div>; }

export function PanelShell({ panelId }: { panelId: string }) {
  const meta = getPanelById(panelId);
  if (!meta) return <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Unknown panel: {panelId}</div>;
  const Component = meta.component;
  return <Suspense fallback={<PanelFallback id={meta.label} />}><div className="panel-enter"><Component /></div></Suspense>;
}
