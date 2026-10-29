import React from 'react';
import { useStore } from '@nanostores/react';
import { $activePanel, setPanel } from '../../stores/ui';
import { AppIcon } from '../brand/AppIcon';
import './ModeSwitcher.css';

const MODES = [
  { id: 'code',   icon: 'code', label: 'Code' },
  { id: 'visual', icon: 'paint', label: 'Visual' },
] as const;

export default function ModeSwitcher() {
  const active = useStore($activePanel);
  return (
    <div className="mode-switcher" role="group" aria-label="Editor mode">
      {MODES.map(m => (
        <button key={m.id}
          className={`mode-btn ${active === m.id ? 'active' : ''}`}
          onClick={() => setPanel(m.id)}
          aria-pressed={active === m.id}
          aria-label={`Switch to ${m.label} mode`}>
          <AppIcon name={m.icon} size={16} />
          <span>{m.label}</span>
        </button>
      ))}
    </div>
  );
}
