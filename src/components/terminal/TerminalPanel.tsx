import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { SandboxAddon } from '@cloudflare/sandbox/xterm';
import { terminalSession, TerminalSession, OutputLine } from '../../services/terminal/TerminalSession';
import './TerminalPanel.css';

interface Tab { id: string; label: string; }
interface Pane {
  id: string;
  tabId: string;
  session: TerminalSession;
  terminal: Terminal | null;
  addon: SandboxAddon | null;
}

function createPane(tabId: string): Pane {
  return {
    id: crypto.randomUUID(),
    tabId,
    session: new TerminalSession(),
    terminal: null,
    addon: null,
  };
}

export default function TerminalPanel() {
  const [tabs, setTabs] = useState<Tab[]>(() => [{ id: crypto.randomUUID(), label: 'Shell 1' }]);
  const [activeTab, setActiveTab] = useState<string>(() => tabs[0].id);
  const [panes, setPanes] = useState<Pane[]>(() => [createPane(tabs[0].id)]);
  const [activePane, setActivePane] = useState<string>(() => panes[0].id);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const paneRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const inputRef  = useRef<HTMLInputElement>(null);

  const activePaneData = panes.find(p => p.id === activePane)!;

  const registerPaneElement = useCallback((paneId: string, el: HTMLDivElement | null) => {
    if (el) paneRefs.current.set(paneId, el);
    else paneRefs.current.delete(paneId);
  }, []);

  useEffect(() => {
    const currentPane = panes.find(p => p.id === activePane);
    if (!currentPane) return;
    currentPane.session.init();
  }, [activePane, panes]);

  useEffect(() => {
    const handler = (line: OutputLine) => {
      const pane = panes.find(p => p.session === terminalSession);
      if (pane) {
        setPanes(prev => prev.map(p => p.id === pane.id ? { ...p, session: p.session } : p));
      }
    };
    terminalSession.onOutput(handler);
    return () => terminalSession.offOutput(handler);
  }, [panes]);

  const initTerminal = useCallback((pane: Pane) => {
    if (!containerRef.current) return;
    const el = paneRefs.current.get(pane.id);
    if (!el) return;

    const term = new Terminal({
      cursorBlink: true,
      theme: { background: '#0D1F1E', foreground: '#E0E0E0' },
      fontSize: 14,
      fontFamily: 'monospace',
    });
    pane.terminal = term;

    const addon = new SandboxAddon({
      getWebSocketUrl: ({ origin, sessionId }) => {
        const wsOrigin = origin.replace(/^http/, 'ws');
        return `${wsOrigin}/ws/terminal/${sessionId ?? 'default'}`;
      },
      reconnect: true,
      onStateChange: (state, error) => {
        if (state === 'connected') {
          pane.session.enableSandbox({ fetch: (req: Request) => Promise.resolve(new Response('connected', { status: 200 })) }, crypto.randomUUID());
        }
        if (state === 'disconnected' && error) {
          pane.session.emit({ type: 'system', text: `Terminal disconnected: ${error.message}` });
        }
      },
    });
    pane.addon = addon;
    term.loadAddon(addon);
    term.open(el);

    const sessionId = crypto.randomUUID();
    addon.connect({ sandboxId: 'devnoder-default', sessionId });

    term.focus();
  }, []);

  useEffect(() => {
    panes.forEach(pane => {
      if (!pane.terminal) initTerminal(pane);
    });
  }, [panes, initTerminal]);

  const addTab = () => {
    const tabId = crypto.randomUUID();
    const tab: Tab = { id: tabId, label: `Shell ${tabs.length + 1}` };
    const pane = createPane(tabId);
    setTabs(t => [...t, tab]);
    setPanes(p => [...p, pane]);
    setActiveTab(tabId);
    setActivePane(pane.id);
  };

  const closeTab = (id: string) => {
    if (tabs.length === 1) return;
    setTabs(t => t.filter(tab => tab.id !== id));
    setPanes(p => p.filter(pane => pane.tabId !== id));
    if (activeTab === id) {
      const remaining = tabs.filter(tab => tab.id !== id);
      if (remaining.length > 0) setActiveTab(remaining[0].id);
    }
  };

  const splitPane = (direction: 'horizontal' | 'vertical') => {
    const currentPane = panes.find(p => p.id === activePane);
    if (!currentPane) return;
    const newPane = createPane(currentPane.tabId);
    newPane.session = currentPane.session;
    setPanes(prev => [...prev, newPane]);
    setActivePane(newPane.id);
  };

  const closePane = (paneId: string) => {
    setPanes(prev => {
      const remaining = prev.filter(p => p.id !== paneId);
      if (remaining.length === 0) return prev;
      if (activePane === paneId) setActivePane(remaining[0].id);
      return remaining;
    });
  };

  const submit = async () => {
    const cmd = input.trim();
    if (!cmd) return;
    setHistory(h => [cmd, ...h.slice(0, 49)]);
    setHistoryIdx(-1);
    setInput('');
    await activePaneData.session.run(cmd);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'e') { e.preventDefault(); splitPane('horizontal'); return; }
      if (e.key === 'o') { e.preventDefault(); splitPane('vertical'); return; }
    }
    if (e.key === 'Enter') { submit(); return; }
    if (e.key === 'ArrowUp') {
      const idx = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(idx);
      setInput(history[idx] ?? '');
    }
    if (e.key === 'ArrowDown') {
      const idx = Math.max(historyIdx - 1, -1);
      setHistoryIdx(idx);
      setInput(idx === -1 ? '' : history[idx]);
    }
  };

  const currentTabPanes = panes.filter(p => p.tabId === activeTab);

  return (
    <div className="terminal-panel" onClick={() => inputRef.current?.focus()}>
      {/* Tab bar */}
      <div className="terminal-tabs">
        {tabs.map(tab => (
          <div key={tab.id} className={`terminal-tab ${tab.id === activeTab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}>
            <span>{tab.label}</span>
            {tabs.length > 1 && (
              <button className="terminal-tab-close"
                onClick={e => { e.stopPropagation(); closeTab(tab.id); }}>×</button>
            )}
          </div>
        ))}
        <button className="terminal-tab-add" onClick={addTab} aria-label="New terminal tab">+</button>
      </div>

      {/* Terminal panes */}
      <div className="terminal-panes">
        {currentTabPanes.map(pane => (
          <div
            key={pane.id}
            className={`terminal-pane ${pane.id === activePane ? 'active' : ''}`}
            onClick={() => setActivePane(pane.id)}
          >
            <div className="terminal-pane-header">
              <span>{pane.session.constructor.name}</span>
              {currentTabPanes.length > 1 && (
                <button className="terminal-pane-close"
                  onClick={e => { e.stopPropagation(); closePane(pane.id); }}>×</button>
              )}
            </div>
            <div className="terminal-pane-body" ref={el => registerPaneElement(pane.id, el)} />
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="terminal-input-row">
        <span className="terminal-prompt-static">$</span>
        <input
          ref={inputRef}
          className="terminal-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Enter command… (Ctrl+E/O to split)"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <button className="terminal-run-btn" onClick={submit}>▶</button>
      </div>
    </div>
  );
}
