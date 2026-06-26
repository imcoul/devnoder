import React from 'react';
import { useStore } from '@nanostores/react';
import { useTranslation } from 'react-i18next';
import { $activePanel, setPanel, PanelId } from '../../stores/ui';
import './BottomNav.css';

const NAV_ITEMS: Array<{ id: PanelId; icon: string; labelKey: string }> = [
  { id: 'code',     icon: '💻', labelKey: 'nav.code' },
  { id: 'visual',   icon: '🎨', labelKey: 'nav.visual' },
  { id: 'terminal', icon: '⌨',  labelKey: 'nav.terminal' },
  { id: 'git',      icon: '🔀', labelKey: 'nav.git' },
  { id: 'ai',       icon: '🤖', labelKey: 'nav.ai' },
  { id: 'preview',  icon: '👁',  labelKey: 'nav.preview' },
  { id: 'collab',   icon: '👥', labelKey: 'nav.collab' },
  { id: 'settings', icon: '⚙',  labelKey: 'nav.settings' },
];

export default function BottomNav() {
  const active = useStore($activePanel);
  const { t } = useTranslation();
  return (
    <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
      {NAV_ITEMS.map(item => (
        <button key={item.id}
          className={`nav-item ${active === item.id ? 'active' : ''}`}
          onClick={() => setPanel(item.id)}
          aria-label={t(item.labelKey)}
          aria-current={active === item.id ? 'page' : undefined}
        >
          <span className="nav-icon" aria-hidden="true">{item.icon}</span>
          <span className="nav-label">{t(item.labelKey)}</span>
        </button>
      ))}
    </nav>
  );
}
