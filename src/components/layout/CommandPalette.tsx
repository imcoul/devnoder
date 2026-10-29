import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { useTranslation } from 'react-i18next';
import { $commandPaletteOpen, toggleCommandPalette, setPanel } from '../../stores/ui';
import { PANELS } from '../panels';
import { AppIcon } from '../brand/AppIcon';
import './CommandPalette.css';

export default function CommandPalette() {
  const open = useStore($commandPaletteOpen);
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const filtered = PANELS.filter(panel => panel.label.toLowerCase().includes(query.toLowerCase()) || panel.id.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement;
      setQuery(''); setCursor(0);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } else if (triggerRef.current) {
      triggerRef.current.focus(); triggerRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') { event.preventDefault(); toggleCommandPalette(); return; }
      if (!open) return;
      if (event.key === 'Escape') { event.preventDefault(); toggleCommandPalette(); }
      if (event.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>('input, button:not([disabled])');
        if (focusable.length) {
          const first = focusable[0]; const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }
      if (event.key === 'ArrowDown') { event.preventDefault(); setCursor(value => Math.min(value + 1, Math.max(filtered.length - 1, 0))); }
      if (event.key === 'ArrowUp') { event.preventDefault(); setCursor(value => Math.max(value - 1, 0)); }
      if (event.key === 'Enter' && filtered[cursor]) { setPanel(filtered[cursor].id as any); toggleCommandPalette(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, cursor]);

  if (!open) return null;
  return (
    <div className="palette-overlay" onClick={() => toggleCommandPalette()}>
      <div ref={modalRef} className="palette-modal" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Command palette">
        <input ref={inputRef} className="palette-input" value={query} onChange={event => { setQuery(event.target.value); setCursor(0); }} placeholder={t('palette.placeholder')} aria-label="Search commands" />
        <div className="palette-list" role="listbox">
          {filtered.map((panel, index) => <button key={panel.id} type="button" className={`palette-item ${index === cursor ? 'focused' : ''}`} onClick={() => { setPanel(panel.id as any); toggleCommandPalette(); }} role="option" aria-selected={index === cursor}>
            <AppIcon name={panel.icon || 'more'} size={17} /><span className="palette-label">{panel.label}</span>{panel.shortcut && <kbd className="palette-shortcut">{panel.shortcut}</kbd>}
          </button>)}
          {filtered.length === 0 && <p className="palette-empty">No results</p>}
        </div>
      </div>
    </div>
  );
}
