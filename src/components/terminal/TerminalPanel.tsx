import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { SandboxAddon } from '@cloudflare/sandbox/xterm';
import { terminalSession, TerminalSession, OutputLine } from '../../services/terminal/TerminalSession';
import './TerminalPanel.css';

interface Tab { id: string; label: string; session: TerminalSession; }

function makeTab(n: number): Tab {
  return { id: crypto.randomUUID(), label: `Shell ${n}`, session: new TerminalSession() };
}

export default function TerminalPanel() {
  const [tabs, setTabs]   = useState<Tab[]>(() => [makeTab(1)]);
  const [activeTab, setActiveTab] = useState<string>(() => tabs[0].id);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [lines, setLines] = useState<Record<string, OutputLine[]>>({});
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const xtermRef  = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const addonRef   = useRef<SandboxAddon | null>(null);

  const currentTab = tabs.find(t => t.id === activeTab)!;

  const appendLine = useCallback((tabId: string, line: OutputLine) => {
    setLines(prev => ({ ...prev, [tabId]: [...(prev[tabId] ?? []), line] }));
  }, []);

  useEffect(() => {
    const tab = tabs[0];
    const handler = (line: OutputLine) => appendLine(tab.id, line);
    tab.session.onOutput(handler);
    tab.session.init();
    return () => tab.session.offOutput(handler);
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  // Initialize xterm.js + SandboxAddon once
  useEffect(() => {
    if (!xtermRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      theme: { background: '#0D1F1E', foreground: '#E0E0E0' },
      fontSize: 14,
      fontFamily: 'monospace',
    });
    terminalRef.current = term;

    const addon = new SandboxAddon({
      getWebSocketUrl: ({ origin, sessionId }) => {
        const wsOrigin = origin.replace(/^http/, 'ws');
        return `${wsOrigin}/ws/terminal/${sessionId ?? 'default'}`;
      },
      reconnect: true,
      onStateChange: (state, error) => {
        if (state === 'connected') {
          currentTab.session.enableSandbox({ fetch: (req: Request) => Promise.resolve(new Response('connected', { status: 200 })) }, sessionId);
        }
        if (state === 'disconnected' && error) {
          currentTab.session.emit({ type: 'system', text: `Terminal disconnected: ${error.message}` });
        }
      },
    });
    addonRef.current = addon;
    term.loadAddon(addon);

    term.open(xtermRef.current);

    // Connect to default session
    const sessionId = crypto.randomUUID();
    addon.connect({ sandboxId: 'devnoder-default', sessionId });

    return () => {
      addon.dispose();
      term.dispose();
    };
  }, []);

  const addTab = () => {
    const tab = makeTab(tabs.length + 1);
    const handler = (line: OutputLine) => appendLine(tab.id, line);
    tab.session.onOutput(handler);
    tab.session.init();
    setTabs(t => [...t, tab]);
    setActiveTab(tab.id);
  };

  const closeTab = (id: string) => {
    if (tabs.length === 1) return;
    setTabs(t => t.filter(tab => tab.id !== id));
    if (activeTab === id) setActiveTab(tabs.find(t => t.id !== id)!.id);
  };

  const submit = async () => {
    const cmd = input.trim();
    if (!cmd) return;
    setHistory(h => [cmd, ...h.slice(0, 49)]);
    setHistoryIdx(-1);
    setInput('');
    await currentTab.session.run(cmd);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
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

  const currentLines = lines[activeTab] ?? [];

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

      {/* xterm.js terminal */}
      <div className="terminal-xterm" ref={xtermRef} />

      {/* Fallback output for non-PTY mode */}
      {!terminalRef.current && (
        <div className="terminal-output" ref={outputRef}>
          {currentLines.map((line, i) => (
            <div key={i} className={`terminal-line terminal-line--${line.type}`}>
              {line.type === 'input'
                ? <><span className="terminal-prompt">$</span> {line.text.replace(/^\$\s*/, '')}</>
                : line.text}
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="terminal-input-row">
        <span className="terminal-prompt-static">$</span>
        <input
          ref={inputRef}
          className="terminal-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Enter command…"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <button className="terminal-run-btn" onClick={submit}>▶</button>
      </div>
    </div>
  );
}
