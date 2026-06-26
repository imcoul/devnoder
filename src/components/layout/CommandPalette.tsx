import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { useTranslation } from 'react-i18next';
import { $commandPaletteOpen, toggleCommandPalette, setPanel } from '../../stores/ui';
import { PANELS } from '../panels';
import './CommandPalette.css';

export default function CommandPalette() {
  const open = useStore($commandPaletteOpen);
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = PANELS.filter(p =>
    p.label.toLowerCase().includes(query.toLowerCase()) ||
    p.id.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (open) { setQuery(''); setCursor(0); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); toggleCommandPalette(); }
      if (!open) return;
      if (e.key === 'Escape') toggleCommandPalette();
      if (e.key === 'ArrowDown') setCursor(c => Math.min(c + 1, filtered.length - 1));
      if (e.key === 'ArrowUp') setCursor(c => Math.max(c - 1, 0));
      if (e.key === 'Enter' && filtered[cursor]) { setPanel(filtered[cursor].id as any); toggleCommandPalette(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, cursor]);

  if (!open) return null;
  return (
    <div className="palette-overlay" onClick={toggleCommandPalette}>
      <div className="palette-modal" onClick={e => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <input ref={inputRef} className="palette-input" value={query}
          onChange={e => { setQuery(e.target.value); setCursor(0); }}
          placeholder={t('palette.placeholder')} />
        <div className="palette-list" role="listbox">
          {filtered.map((p, i) => (
            <button key={p.id} className={`palette-item ${i === cursor ? 'focused' : ''}`}
              onClick={() => { setPanel(p.id as any); toggleCommandPalette(); }}
              role="option" aria-selected={i === cursor}>
              <span className="palette-icon">{p.icon}</span>
              <span className="palette-label">{p.label}</span>
              {p.shortcut && <kbd className="palette-shortcut">{p.shortcut}</kbd>}
            </button>
          ))}
          {filtered.length === 0 && <p className="palette-empty">No results</p>}
        </div>
      </div>
    </div>
  );
}
