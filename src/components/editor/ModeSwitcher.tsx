import React from 'react';
import { useStore } from '@nanostores/react';
import { $activePanel, setPanel } from '../../stores/ui';
import './ModeSwitcher.css';

const MODES = [
  { id: 'code',   icon: '💻', label: 'Code' },
  { id: 'visual', icon: '🎨', label: 'Visual' },
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
          <span aria-hidden="true">{m.icon}</span>
          <span>{m.label}</span>
        </button>
      ))}
    </div>
  );
}
