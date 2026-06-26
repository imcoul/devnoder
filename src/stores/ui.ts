import { atom, map } from 'nanostores';

export type PanelId =
  | 'code' | 'visual' | 'terminal' | 'git' | 'ai'
  | 'preview' | 'collab' | 'docs' | 'api' | 'health'
  | 'community' | 'settings' | 'plugins' | 'billing' | 'about'
  | 'feedback' | 'mcp' | 'skills';       // Sprints 11–13

export type ThemeId = 'default' | 'light' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'hc-aaa' | 'hc-light' | 'grayscale';
export type Lang = 'en' | 'fr' | 'ar';

export const $activePanel = atom<PanelId>('code');
export const $theme       = atom<ThemeId>('default');
export const $commandPaletteOpen = atom(false);
export const $lang        = atom<Lang>('en');

export const $ui = map({
  sidebarOpen: false,
  fontSize: 14,
  tabSize: 2,
  wordWrap: false,
});

export interface Toast { id: string; type: 'info' | 'success' | 'error' | 'warn'; message: string; }
export const $toasts = atom<Toast[]>([]);

export function showToast(toast: Omit<Toast, 'id'>) {
  const id = crypto.randomUUID();
  $toasts.set([...$toasts.get(), { ...toast, id }]);
  setTimeout(() => { $toasts.set($toasts.get().filter(t => t.id !== id)); }, 4000);
}

export function setPanel(id: PanelId)   { $activePanel.set(id); }
export function toggleCommandPalette()  { $commandPaletteOpen.set(!$commandPaletteOpen.get()); }
