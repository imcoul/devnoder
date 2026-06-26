import React, { useState, useEffect, useRef, useCallback } from 'react';
import { aiGateway, MODELS, Message } from '../../services/ai/AIGateway';
import { AGENTS, AgentId, agentRunner } from '../../services/ai/AIAgents';
import { parseMessage, BoltAction } from '../../services/ai/StreamingMessageParser';
import { webLLMManager } from '../../services/ai/WebLLMManager';
import { writeFile } from '../../services/git/GitService';
import { bufferManager, $activeBuffer, $buffers } from '../../services/editor/BufferManager';
import { feedbackStore } from '../../services/ai/FeedbackStore';
import { showToast } from '../../stores/ui';
import { useStore } from '@nanostores/react';
import './AIPanel.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  feedbackId?: number;   // set after saving to FeedbackStore
  toolCalls?: ToolCallEvent[];
  rated?: 'good' | 'bad' | 'edited';
  editing?: boolean;
  editDraft?: string;
}

function ActionBlock({ action }: { action: BoltAction }) {
  const [applied, setApplied] = useState(false);
  const apply = async () => {
    if (action.type === 'file' && action.filePath) {
      await writeFile(action.filePath, action.content);
      bufferManager.open(action.filePath, action.content);
      setApplied(true);
      showToast({ type: 'success', message: `Applied ${action.filePath}` });
    }
  };
  return (
    <div className="action-block">
      <div className="action-header">
        <span className="action-type">{action.type === 'file' ? '📄' : '⌨'}</span>
        <span className="action-path">{action.filePath ?? 'shell'}</span>
        {action.type === 'file' && (
          <button className="action-apply" onClick={apply} disabled={applied}>
            {applied ? '✓ Applied' : 'Apply'}
          </button>
        )}
      </div>
      <pre className="action-code">{action.content}</pre>
    </div>
  );
}


function ToolCallBlock({ evt }: { evt: ToolCallEvent }) {
  const running = evt.result === undefined;
  return (
    <div className="tool-call-block">
      <div className="tool-call-head">
        <span className="tool-call-icon">🛠</span>
        <span className="tool-call-name">{evt.name}</span>
        <span className={`tool-call-status tool-call-status--${running ? 'running' : 'done'}`}>
          {running ? 'running…' : 'done'}
        </span>
      </div>
      <div className="tool-call-args">{JSON.stringify(evt.args, null, 2)}</div>
      {evt.result !== undefined && (
        <div className="tool-call-result">{evt.result}</div>
      )}
    </div>
  );
}

function MessageBubble({
  msg, onRate, onEditSubmit,
}: {
  msg: ChatMessage;
  onRate: (id: string, rating: 'good' | 'bad' | 'edited', edited?: string) => void;
  onEditSubmit: (id: string, edited: string) => void;
}) {
  const [draft, setDraft] = useState(msg.content);
  const parsed = msg.role === 'assistant' ? parseMessage(msg.content) : null;

  return (
    <div className={`chat-msg chat-msg--${msg.role}`}>
      {msg.role === 'assistant' && parsed ? (
        <>
          {parsed.textBefore && <p className="chat-text">{parsed.textBefore}</p>}
          {parsed.actions.map((a, i) => <ActionBlock key={i} action={a} />)}
          {parsed.textAfter && <p className="chat-text">{parsed.textAfter}</p>}
          {msg.toolCalls?.map((tc, i) => <ToolCallBlock key={`${tc.id}-${i}`} evt={tc} />)}
        </>
      ) : (
        <p className="chat-text">{msg.content}</p>
      )}

      {/* Feedback row — only on assistant messages, only when complete */}
      {msg.role === 'assistant' && msg.content && (
        <div className="msg-feedback">
          {!msg.rated && !msg.editing && (
            <>
              <button className="feedback-btn" onClick={() => onRate(msg.id, 'good')}
                aria-label="Good response" title="Good response">👍</button>
              <button className="feedback-btn" onClick={() => onRate(msg.id, 'bad')}
                aria-label="Bad response" title="Bad response">👎</button>
              <button className="feedback-btn" onClick={() => onRate(msg.id, 'edited')}
                aria-label="Edit response" title="Edit to correct">✏️</button>
            </>
          )}
          {msg.rated && !msg.editing && (
            <span className="feedback-rated">
              {msg.rated === 'good' ? '👍' : msg.rated === 'bad' ? '👎' : '✏️'} rated
            </span>
          )}
          {msg.editing && (
            <div className="feedback-edit-area">
              <textarea className="feedback-edit-textarea" value={draft}
                onChange={e => setDraft(e.target.value)} rows={4} />
              <div className="feedback-edit-actions">
                <button className="feedback-edit-cancel"
                  onClick={() => onRate(msg.id, 'edited', undefined)}>Cancel</button>
                <button className="feedback-edit-save"
                  onClick={() => onEditSubmit(msg.id, draft)}>Save correction</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AIPanel() {
  const [messages, setMessages]     = useState<ChatMessage[]>([]);
  const [input, setInput]           = useState('');
  const [agentId, setAgentId]       = useState<AgentId>('code');
  const [modelId, setModelId]       = useState(MODELS[0].id);
  const [streaming, setStreaming]   = useState(false);
  const [loadProgress, setLoadProgress] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [keys, setKeys]             = useState({ groq: '', openai: '', anthropic: '', openrouter: '' });
  const bottomRef  = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeId     = useStore($activeBuffer);
  const buffers      = useStore($buffers);
  const activeBuffer = buffers.find(b => b.id === activeId);

  useEffect(() => {
    aiGateway.loadKeys();
    webLLMManager.loadCustomModels();
    webLLMManager.onProgress((p, label) => setLoadProgress(p < 100 ? `${label} (${p}%)` : null));
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { aiGateway.setModel(modelId); }, [modelId]);

  // Sprint 15 — auto-select custom fine-tuned model when preference is set
  useEffect(() => {
    const preferred = localStorage.getItem('devnoder-preferred-code-model');
    if (preferred && MODELS.find(m => m.id === preferred)) {
      setModelId(preferred);
    }
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setStreaming(true);
    import('../../services/accessibility/AudioCueService')
      .then(m => m.audioCueService.cue('ai-thinking'))
      .catch(() => {});

    const assistantId = crypto.randomUUID();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    const history: Message[] = messages.map(m => ({ role: m.role, content: m.content }));
    let fullResponse = '';

    const activeToolCalls = new Map<string, ToolCallEvent>();
    await agentRunner.run(agentId, text, history, chunk => {
      if (typeof chunk === 'string') {
        fullResponse += chunk;
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: m.content + chunk } : m
        ));
      } else if (chunk && typeof chunk === 'object' && 'toolCall' in chunk) {
        const evt = (chunk as any).toolCall as ToolCallEvent;
        activeToolCalls.set(evt.id, evt);
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, toolCalls: Array.from(activeToolCalls.values()) }
            : m
        ));
      }
    });

    // Save to FeedbackStore (no rating yet — user will rate later)
    try {
      const fid = await feedbackStore.add({
        timestamp: Date.now(),
        agentId,
        modelId,
        messages: [...history, { role: 'user', content: text }],
        response: fullResponse,
        rating: 'good', // neutral default until user rates
        language: activeBuffer?.language ?? '',
        projectName: activeBuffer?.path?.split('/')[1] ?? 'unknown',
      });
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, feedbackId: fid, rated: undefined } : m
      ));
    } catch { /* non-critical */ }

    setStreaming(false);
    import('../../services/accessibility/AudioCueService')
      .then(m => m.audioCueService.cue('ai-done'))
      .catch(() => {});
  }, [input, streaming, agentId, modelId, messages, activeBuffer]);

  const handleRate = async (msgId: string, rating: 'good' | 'bad' | 'edited', edited?: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg?.feedbackId) return;

    if (rating === 'edited' && edited === undefined) {
      // Open edit mode
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, editing: true, editDraft: m.content } : m));
      return;
    }

    await feedbackStore.rate(msg.feedbackId, rating, edited);
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, rated: rating, editing: false } : m
    ));
    showToast({ type: 'success', message: rating === 'edited' ? 'Correction saved to training data' : 'Feedback saved locally' });
  };

  const handleEditSubmit = async (msgId: string, edited: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg?.feedbackId) return;
    await feedbackStore.rate(msg.feedbackId, 'edited', edited);
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, rated: 'edited', editing: false } : m
    ));
    showToast({ type: 'success', message: 'Correction saved — great training data!' });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const saveKeys = () => {
    if (keys.groq && !keys.groq.startsWith('•'))       aiGateway.setKey('groq', keys.groq);
    if (keys.openai && !keys.openai.startsWith('•'))   aiGateway.setKey('openai', keys.openai);
    if (keys.anthropic && !keys.anthropic.startsWith('•')) aiGateway.setKey('anthropic', keys.anthropic);
    if (keys.openrouter && !keys.openrouter.startsWith('•')) aiGateway.setKey('openrouter', keys.openrouter);
    setShowSettings(false);
    showToast({ type: 'success', message: 'API keys saved locally' });
  };

  const selectedModel = MODELS.find(m => m.id === modelId) ?? MODELS[0];

  return (
    <div className="ai-panel">
      <div className="ai-header">
        <div className="agent-pills">
          {AGENTS.map(a => (
            <button key={a.id} className={`agent-pill ${agentId === a.id ? 'active' : ''}`}
              onClick={() => setAgentId(a.id)} title={a.description}>{a.icon}</button>
          ))}
        </div>
        <select className="model-select" value={modelId} onChange={e => setModelId(e.target.value)}>
          {MODELS.map(m => (
            <option key={m.id} value={m.id}>
              {m.label}{m.free ? ' ★' : ''}{m.id.startsWith('custom-') ? ' 🎯' : ''}
            </option>
          ))}
        </select>
        <button className="ai-settings-btn" onClick={() => setShowSettings(s => !s)}>⚙</button>
      </div>

      {loadProgress && <div className="ai-load-progress">{loadProgress}</div>}

      <div className="ai-agent-label">
        {AGENTS.find(a => a.id === agentId)?.icon} {AGENTS.find(a => a.id === agentId)?.label} Agent
        <span className="ai-model-badge">{selectedModel.label}</span>
        {selectedModel.offlineCapable && <span className="ai-offline-badge">Offline</span>}
      </div>

      <div className="ai-messages">
        {messages.length === 0 && (
          <div className="ai-welcome">
            <span className="ai-welcome-icon">🤖</span>
            <p>Ask anything about your code</p>
            <p className="ai-welcome-sub">Shift+Enter for new line · Enter to send</p>
            <p className="ai-welcome-sub">Rate responses 👍👎✏️ to build training data</p>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} onRate={handleRate} onEditSubmit={handleEditSubmit} />
        ))}
        {streaming && <div className="ai-typing"><span /><span /><span /></div>}
        <div ref={bottomRef} />
      </div>

      <div className="ai-input-area">
        <textarea ref={textareaRef} className="ai-textarea" value={input}
          onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown}
          placeholder={`Ask the ${AGENTS.find(a => a.id === agentId)?.label} agent…`}
          rows={3} />
        {/* Auto-select preference — shown when a custom model is selected */}
        {modelId.startsWith('custom-') && (
          <div className="ai-custom-model-bar">
            <span className="ai-custom-badge">🎯 Custom model active</span>
            <button className="ai-set-default-btn"
              onClick={() => {
                localStorage.setItem('devnoder-preferred-code-model', modelId);
                showToast({ type: 'success', message: 'Set as default model for code panels' });
              }}>
              Set as default
            </button>
            <button className="ai-clear-default-btn"
              onClick={() => {
                localStorage.removeItem('devnoder-preferred-code-model');
                showToast({ type: 'info', message: 'Default model preference cleared' });
              }}>
              Clear default
            </button>
          </div>
        )}
        <div className="ai-input-actions">
          <button className="ai-clear-btn" onClick={() => setMessages([])}>Clear</button>
          {streaming
            ? <button className="ai-stop-btn" onClick={() => agentRunner.abort()}>Stop</button>
            : <button className="ai-send-btn" onClick={send} disabled={!input.trim()}>Send ↑</button>
          }
        </div>
      </div>

      {showSettings && (
        <div className="ai-settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="ai-settings-modal" onClick={e => e.stopPropagation()}>
            <div className="ai-settings-head">
              <span>API Keys</span>
              <button onClick={() => setShowSettings(false)}>×</button>
            </div>
            {[
              { id: 'groq', label: 'Groq (free)', placeholder: 'gsk_…', link: 'https://console.groq.com' },
              { id: 'openai', label: 'OpenAI', placeholder: 'sk-…', link: 'https://platform.openai.com' },
              { id: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-…', link: 'https://console.anthropic.com' },
              { id: 'openrouter', label: 'OpenRouter (free models)', placeholder: 'sk-or-…', link: 'https://openrouter.ai' },
            ].map(({ id, label, placeholder, link }) => (
              <div key={id} className="ai-key-row">
                <label><a href={link} target="_blank" rel="noopener noreferrer">{label}</a></label>
                <input type="password" placeholder={placeholder}
                  value={keys[id as keyof typeof keys]}
                  onChange={e => setKeys(k => ({ ...k, [id]: e.target.value }))} />
              </div>
            ))}
            <button className="ai-send-btn" onClick={saveKeys}>Save Keys</button>
            <p className="ai-key-note">Keys stored locally — never sent to Srvel or anywhere except your chosen provider.</p>
          </div>
        </div>
      )}
    </div>
  );
}
