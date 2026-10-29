import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { useTranslation } from 'react-i18next';
import { $activePanel, setPanel, PanelId } from '../../stores/ui';
import { AppIcon } from '../brand/AppIcon';
import './BottomNav.css';

const PRIMARY: Array<{ id: PanelId; icon: string; labelKey: string }> = [
  { id: 'code', icon: 'code', labelKey: 'nav.code' },
  { id: 'ai', icon: 'ai', labelKey: 'nav.ai' },
  { id: 'preview', icon: 'preview', labelKey: 'nav.preview' },
  { id: 'git', icon: 'git', labelKey: 'nav.git' },
];

const SECONDARY: Array<{ id: PanelId; icon: string; labelKey: string }> = [
  { id: 'visual', icon: 'visual', labelKey: 'nav.visual' },
  { id: 'terminal', icon: 'terminal', labelKey: 'nav.terminal' },
  { id: 'collab', icon: 'more', labelKey: 'nav.collab' },
  { id: 'docs', icon: 'docs', labelKey: 'nav.docs' },
  { id: 'api', icon: 'more', labelKey: 'nav.api' },
  { id: 'health', icon: 'more', labelKey: 'nav.health' },
  { id: 'community', icon: 'more', labelKey: 'nav.community' },
  { id: 'plugins', icon: 'more', labelKey: 'nav.plugins' },
  { id: 'settings', icon: 'settings', labelKey: 'nav.settings' },
  { id: 'billing', icon: 'more', labelKey: 'nav.billing' },
  { id: 'about', icon: 'about', labelKey: 'nav.about' },
  { id: 'feedback', icon: 'more', labelKey: 'nav.feedback' },
  { id: 'mcp', icon: 'more', labelKey: 'nav.mcp' },
  { id: 'skills', icon: 'more', labelKey: 'nav.skills' },
];

export default function BottomNav() {
  const active = useStore($activePanel);
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMoreOpen(false); moreButtonRef.current?.focus(); return; }
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = drawerRef.current.querySelectorAll<HTMLElement>('button:not([disabled])');
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    window.setTimeout(() => drawerRef.current?.querySelector<HTMLElement>('button')?.focus(), 0);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moreOpen]);

  const choose = (id: PanelId) => { setPanel(id); setMoreOpen(false); moreButtonRef.current?.focus(); };

  return (
    <>
      {moreOpen && <button type="button" className="more-backdrop" aria-label="Close More menu" onClick={() => { setMoreOpen(false); moreButtonRef.current?.focus(); }} />}
      {moreOpen && (
        <div id="more-tools-drawer" className="more-drawer" ref={drawerRef} role="dialog" aria-modal="true" aria-label="More tools">
          <div className="more-drawer__heading"><h2>More tools</h2><button type="button" onClick={() => { setMoreOpen(false); moreButtonRef.current?.focus(); }} aria-label="Close More tools"><AppIcon name="close" size={18} /></button></div>
          <div className="more-drawer__grid">
            {SECONDARY.map(item => <button key={item.id} type="button" className={`more-item ${active === item.id ? 'active' : ''}`} onClick={() => choose(item.id)} aria-current={active === item.id ? 'page' : undefined}>
              <AppIcon name={item.icon} size={18} /><span>{t(item.labelKey, item.id)}</span>
            </button>)}
          </div>
        </div>
      )}
      <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
        {PRIMARY.map(item => <button key={item.id} type="button" className={`nav-item ${active === item.id ? 'active' : ''}`} onClick={() => setPanel(item.id)} aria-label={t(item.labelKey)} aria-current={active === item.id ? 'page' : undefined}>
          <AppIcon name={item.icon} size={20} /><span className="nav-label">{t(item.labelKey)}</span>
        </button>)}
        <button ref={moreButtonRef} type="button" className={`nav-item ${moreOpen || !PRIMARY.some(item => item.id === active) ? 'active' : ''}`} onClick={() => setMoreOpen(value => !value)} aria-expanded={moreOpen} aria-controls="more-tools-drawer" aria-label="More">
          <AppIcon name="more" size={20} /><span className="nav-label">More</span>
        </button>
      </nav>
    </>
  );
}
