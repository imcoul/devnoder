import React, { useState, useEffect, useRef, useCallback } from 'react';
import { aiGateway, MODELS, type Message, type ModelConfig, type ToolCallEvent } from '../../services/ai/AIGateway';
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

interface LocalModelProgress {
  modelId: string;
  percent: number;
  label: string;
}

function formatStorageBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KiB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GiB`;
}

function ActionBlock({ action }: { action: BoltAction }) {
  const [applied, setApplied] = useState(false);
  const [applying, setApplying] = useState(false);
  const apply = async () => {
    if (action.type !== 'file' || !action.filePath || applying || applied) return;
    const openBuffer = $buffers.get().find(buffer => buffer.path === action.filePath);
    if (openBuffer?.dirty && !window.confirm(`Replace unsaved edits in ${action.filePath}?`)) return;
    setApplying(true);
    try {
      if (openBuffer && (openBuffer.dirty || openBuffer.saving)) {
        await bufferManager.save(openBuffer.id);
      }
      await writeFile(action.filePath, action.content);
      bufferManager.replaceSaved(action.filePath, action.content);
      setApplied(true);
      showToast({ type: 'success', message: `Applied ${action.filePath}` });
    } catch (error) {
      showToast({ type: 'error', message: error instanceof Error ? error.message : 'File change could not be applied' });
    } finally {
      setApplying(false);
    }
  };
  return (
    <div className="action-block">
      <div className="action-header">
        <span className="action-type">{action.type === 'file' ? '📄' : '⌨'}</span>
        <span className="action-path">{action.filePath ?? 'shell'}</span>
        {action.type === 'file' && (
          <button className="action-apply" onClick={apply} disabled={applied || applying}>
            {applied ? '✓ Applied' : applying ? 'Applying…' : 'Apply'}
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
  const [modelId, setModelId]       = useState(() => localStorage.getItem('devnoder-selected-model') ?? MODELS[0].id);
  const [modelCatalog, setModelCatalog] = useState<ModelConfig[]>(MODELS);
  const [streaming, setStreaming]   = useState(false);
  const [loadProgress, setLoadProgress] = useState<LocalModelProgress | null>(null);
  const [cachedFiles, setCachedFiles] = useState<boolean | null>(null);
  const [modelAction, setModelAction] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [storageEstimate, setStorageEstimate] = useState<{ usage?: number; quota?: number } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [prebuiltModels, setPrebuiltModels] = useState<Array<{
    id: string; repository: string; vramRequiredMB?: number; lowResourceRequired: boolean;
  }>>([]);
  const [prebuiltModelsLoaded, setPrebuiltModelsLoaded] = useState(false);
  const [prebuiltModelsLoading, setPrebuiltModelsLoading] = useState(false);
  const [prebuiltModelsError, setPrebuiltModelsError] = useState<string | null>(null);
  const [prebuiltQuery, setPrebuiltQuery] = useState('');
  const [transformersRepositoryId, setTransformersRepositoryId] = useState('');
  const [keys, setKeys]             = useState({ groq: '', openai: '', anthropic: '', openrouter: '' });
  const [customEndpointConfigured, setCustomEndpointConfigured] = useState(false);
  const [customEndpointForm, setCustomEndpointForm] = useState({
    label: 'Custom model server', baseUrl: '', model: '', apiKey: '',
  });
  const bottomRef  = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeId     = useStore($activeBuffer);
  const buffers      = useStore($buffers);
  const activeBuffer = buffers.find(b => b.id === activeId);
  const selectedModel = modelCatalog.find(m => m.id === modelId) ?? MODELS[0];

  useEffect(() => {
    void aiGateway.loadKeys().then(() => {
      const catalog = aiGateway.getModels();
      setModelCatalog(catalog);
      const savedModel = localStorage.getItem('devnoder-selected-model') ?? MODELS[0].id;
      const activeModel = catalog.some(model => model.id === savedModel) ? savedModel : MODELS[0].id;
      setModelId(activeModel);
      aiGateway.setModel(activeModel);
      const saved = aiGateway.getCustomEndpointSettings();
      if (saved) {
        setCustomEndpointConfigured(true);
        setCustomEndpointForm({
          label: saved.label,
          baseUrl: saved.baseUrl,
          model: saved.model,
          apiKey: saved.hasApiKey ? '••••••••' : '',
        });
      }
    }).catch(error => showToast({
      type: 'error', message: error instanceof Error ? error.message : 'AI settings could not be loaded',
    }));
    const unsubscribeProgress = webLLMManager.onProgress((percent, label, progressModelId) => {
      setLoadProgress({ modelId: progressModelId, percent, label });
    });
    return unsubscribeProgress;
  }, []);

  useEffect(() => {
    if (!selectedModel.offlineCapable) {
      setCachedFiles(null);
      setModelError(null);
      return;
    }
    let active = true;
    setCachedFiles(null);
    setModelError(null);
    void webLLMManager.hasCachedModelFiles(modelId)
      .then(result => { if (active) setCachedFiles(result); })
      .catch(() => { if (active) setCachedFiles(null); });
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      void navigator.storage.estimate().then(result => {
        if (active) setStorageEstimate({ usage: result.usage, quota: result.quota });
      }).catch(() => { if (active) setStorageEstimate(null); });
    }
    return () => { active = false; };
  }, [modelId, selectedModel.offlineCapable]);

  useEffect(() => {
    if (!showSettings || prebuiltModelsLoaded || prebuiltModelsLoading) return;
    let active = true;
    setPrebuiltModelsLoading(true);
    setPrebuiltModelsError(null);
    void import('../../services/ai/LocalModelCatalog').then(module => module.listPrebuiltLocalModels())
      .then(models => { if (active) setPrebuiltModels(models); })
      .catch(error => {
        if (active) setPrebuiltModelsError(error instanceof Error ? error.message : 'The local model catalog could not be loaded.');
      })
      .finally(() => {
        setPrebuiltModelsLoading(false);
        if (active) {
          setPrebuiltModelsLoaded(true);
        }
      });
    return () => { active = false; };
  }, [showSettings, prebuiltModelsLoaded, prebuiltModelsLoading]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    aiGateway.setModel(modelId);
    localStorage.setItem('devnoder-selected-model', modelId);
  }, [modelId]);

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
    try {
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
          rating: 'good',
          language: activeBuffer?.language ?? '',
          projectName: activeBuffer?.path?.split('/')[1] ?? 'unknown',
        });
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, feedbackId: fid, rated: undefined } : m
        ));
      } catch { /* feedback persistence is non-critical */ }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The model request failed.';
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: `${m.content}${m.content ? '\n\n' : ''}Request failed: ${message}` } : m
      ));
      showToast({ type: 'error', message });
    } finally {
      setStreaming(false);
      import('../../services/accessibility/AudioCueService')
        .then(m => m.audioCueService.cue('ai-done'))
        .catch(() => {});
    }
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

  const saveCustomEndpoint = async () => {
    try {
      await aiGateway.configureCustomEndpoint(customEndpointForm);
      setModelCatalog(aiGateway.getModels());
      setCustomEndpointConfigured(true);
      setModelId('custom-openai-compatible');
      const saved = aiGateway.getCustomEndpointSettings();
      setCustomEndpointForm(form => ({ ...form, apiKey: saved?.hasApiKey ? '••••••••' : '' }));
      showToast({ type: 'success', message: 'Custom endpoint saved. Its model is now in the picker.' });
    } catch (error) {
      showToast({ type: 'error', message: error instanceof Error ? error.message : 'Endpoint settings could not be saved' });
    }
  };

  const removeCustomEndpoint = () => {
    aiGateway.removeCustomEndpoint();
    setModelCatalog(aiGateway.getModels());
    setCustomEndpointConfigured(false);
    setCustomEndpointForm({ label: 'Custom model server', baseUrl: '', model: '', apiKey: '' });
    if (modelId === 'custom-openai-compatible') setModelId(MODELS[0].id);
    showToast({ type: 'info', message: 'Custom endpoint removed from this browser.' });
  };

  const prepareSelectedLocalModel = async () => {
    if (modelAction || !selectedModel.offlineCapable) return;
    setModelAction(true);
    setModelError(null);
    try {
      if (!navigator.onLine && !webLLMManager.isLoadedFor(modelId)) {
        const cached = await webLLMManager.hasCachedModelFiles(modelId);
        if (!cached) throw new Error('You are offline and this model is not confirmed in the browser cache. Reconnect before preparing it.');
      }
      await webLLMManager.load(modelId);
      setCachedFiles(true);
      showToast({ type: 'success', message: `${selectedModel.label} is ready in this tab.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The local model could not be prepared.';
      setModelError(message);
      showToast({ type: 'error', message });
    } finally {
      setModelAction(false);
    }
  };

  const unloadSelectedLocalModel = async () => {
    if (modelAction) return;
    setModelAction(true);
    setModelError(null);
    try {
      await webLLMManager.unload();
      showToast({ type: 'info', message: `${selectedModel.label} unloaded from this tab.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The local model could not be unloaded.';
      setModelError(message);
    } finally {
      setModelAction(false);
    }
  };

  const clearSelectedModelCache = async () => {
    if (modelAction || !window.confirm(`Remove cached files for ${selectedModel.label} from this browser? The model will need to download again.`)) return;
    setModelAction(true);
    setModelError(null);
    try {
      await webLLMManager.deleteCachedModelFiles(modelId);
      setCachedFiles(false);
      showToast({ type: 'success', message: 'Model cache removed from this browser.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The cached model files could not be removed.';
      setModelError(message);
    } finally {
      setModelAction(false);
    }
  };

  const addPrebuiltLocalModel = async (localId: string) => {
    try {
      const added = await aiGateway.addPrebuiltLocalModel(localId);
      setModelCatalog(aiGateway.getModels());
      setModelId(added.id);
      setShowSettings(false);
      showToast({ type: 'success', message: `${added.label} added. Select Download & load to fetch it on this device.` });
    } catch (error) {
      showToast({ type: 'error', message: error instanceof Error ? error.message : 'This model could not be added.' });
    }
  };

  const addTransformersModel = () => {
    try {
      const added = aiGateway.addTransformersCompatibleModel(transformersRepositoryId);
      setModelCatalog(aiGateway.getModels());
      setModelId(added.id);
      setTransformersRepositoryId('');
      setShowSettings(false);
      showToast({ type: 'success', message: `${added.label} added. Select Download & load to test and cache it on this device.` });
    } catch (error) {
      showToast({ type: 'error', message: error instanceof Error ? error.message : 'This repository ID is not valid.' });
    }
  };

  const webgpuAvailable = typeof navigator !== 'undefined' && 'gpu' in navigator;
  const modelRuntimeAvailable = webgpuAvailable || !!selectedModel.transformersModelId;
  const selectedModelProgress = loadProgress?.modelId === modelId ? loadProgress : null;
  const filteredPrebuiltModels = prebuiltModels
    .filter(model => model.id.toLowerCase().includes(prebuiltQuery.trim().toLowerCase()))
    .slice(0, 8);
  const localModelIsLoaded = webLLMManager.isLoadedFor(modelId);

  return (
    <div className="ai-panel">
      <div className="ai-header">
        <div className="agent-pills" role="group" aria-label="AI agent">
          {AGENTS.map(a => (
            <button key={a.id} className={`agent-pill ${agentId === a.id ? 'active' : ''}`}
              onClick={() => setAgentId(a.id)} title={a.description}
              aria-pressed={agentId === a.id} aria-label={`${a.label} agent — ${a.description}`}>{a.icon}</button>
          ))}
        </div>
        <select className="model-select" aria-label="AI model" value={modelId} onChange={e => setModelId(e.target.value)}>
          {modelCatalog.map(m => (
            <option key={m.id} value={m.id}>
              {m.label}{m.free ? ' ★' : ''}{m.id.startsWith('custom-') ? ' 🎯' : ''}
            </option>
          ))}
        </select>
        <button className="ai-settings-btn" onClick={() => setShowSettings(s => !s)} aria-label="AI provider and model settings">⚙</button>
      </div>

      {selectedModelProgress && (
        <div className="ai-load-progress" role="status" aria-live="polite">
          <span>{selectedModelProgress.label} ({selectedModelProgress.percent}%)</span>
          <progress max={100} value={selectedModelProgress.percent} aria-label="Local model download progress" />
        </div>
      )}

      <div className="ai-agent-label">
        {AGENTS.find(a => a.id === agentId)?.icon} {AGENTS.find(a => a.id === agentId)?.label} Agent
        <span className="ai-model-badge">{selectedModel.label}</span>
        {selectedModel.offlineCapable && (
          <span className="ai-offline-badge" title="On-device model. Prepare it explicitly below; the browser may evict cached weights.">
            On-device model
          </span>
        )}
      </div>

      {selectedModel.offlineCapable && (
        <section className="ai-local-model-manager" aria-label="Local model download and cache">
          <div className="ai-local-model-status" role="status" aria-live="polite">
            {localModelIsLoaded
              ? 'Ready in this tab'
              : cachedFiles === true
                ? 'Cached model files found — load to verify they are complete'
                : cachedFiles === false
                  ? 'Model files are not cached; preparing will download them'
                  : 'Checking local cache…'}
          </div>
          {selectedModel.vramRequiredMB !== undefined && (
            <p className="ai-key-note">
              WebLLM registry estimate: {Math.round(selectedModel.vramRequiredMB)} MiB GPU memory. This is a runtime-memory estimate, not the download size.
            </p>
          )}
          {storageEstimate?.quota !== undefined && (
            <p className="ai-key-note">
              Browser origin storage: approximately {formatStorageBytes(storageEstimate.usage ?? 0)} used of {formatStorageBytes(storageEstimate.quota)}. The browser controls eviction; this figure is not a model-size estimate.
            </p>
          )}
          {localModelIsLoaded ? (
            <button className="ai-clear-btn" onClick={unloadSelectedLocalModel} disabled={modelAction}>
              {modelAction ? 'Unloading…' : 'Unload from this tab'}
            </button>
          ) : (
            <button className="ai-send-btn" onClick={prepareSelectedLocalModel}
              disabled={modelAction || !modelRuntimeAvailable || (cachedFiles === null && !navigator.onLine)}>
              {modelAction ? 'Preparing model…' : cachedFiles ? 'Load model on this device' : 'Download & load model'}
            </button>
          )}
          {!modelRuntimeAvailable && <p className="ai-key-note">This model needs WebGPU on this browser. The current browser exposes no WebGPU runtime and this model has no validated WASM fallback.</p>}
          {modelError && <p className="ai-local-model-error" role="alert">{modelError}</p>}
          {(cachedFiles || localModelIsLoaded) && (
            <button className="ai-clear-btn" onClick={clearSelectedModelCache} disabled={modelAction}>
              Remove this model’s cached files
            </button>
          )}
          <p className="ai-key-note">
            Local models are limited to the pinned WebLLM registry or compatible Transformers.js ONNX repositories. Downloads may be large, require network access and cannot be reliably cancelled by this runtime. Browser storage is best-effort; offline use is not guaranteed.
          </p>
          <button className="ai-set-default-btn" onClick={() => setShowSettings(true)}>Browse supported local models</button>
        </section>
      )}

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
          aria-label={`Message the ${AGENTS.find(a => a.id === agentId)?.label} agent`}
          onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown}
          placeholder={`Ask the ${AGENTS.find(a => a.id === agentId)?.label} agent…`}
          rows={3} />
        {modelId === 'custom-openai-compatible' && (
          <div className="ai-custom-model-bar">
            <span className="ai-custom-badge">Custom endpoint active</span>
            <span>Your prompts and code go directly to that server.</span>
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
              <span>AI and model settings</span>
              <button onClick={() => setShowSettings(false)} aria-label="Close">×</button>
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

            <section style={{ borderTop: '1px solid var(--color-border)', marginTop: '1rem', paddingTop: '1rem' }}>
              <h3 style={{ margin: '0 0 0.5rem' }}>Supported on-device model catalog</h3>
              <p className="ai-key-note">
                Search the prebuilt chat-model registry shipped with this WebLLM version. For a public Hugging Face model outside that list, use the Transformers.js-compatible ONNX option below. Neither path accepts GGUF files; model sizes vary and the browser controls storage eviction.
              </p>
              <div className="ai-key-row">
                <label htmlFor="prebuilt-model-search">Search model IDs</label>
                <input id="prebuilt-model-search" value={prebuiltQuery}
                  onChange={e => setPrebuiltQuery(e.target.value)} placeholder="e.g. Qwen, Llama, Phi" />
              </div>
              {prebuiltModelsLoading && <p role="status">Loading compatible model registry…</p>}
              {prebuiltModelsError && <p className="ai-local-model-error" role="alert">{prebuiltModelsError}</p>}
              <div className="ai-model-library" role="list" aria-label="Compatible prebuilt local models">
                {filteredPrebuiltModels.map(model => {
                  const alreadyAdded = modelCatalog.some(item => item.id === model.id);
                  return (
                    <div key={model.id} className="ai-model-library-item" role="listitem">
                      <div className="ai-model-library-info">
                        <code>{model.id}</code>
                        <span>
                          {model.vramRequiredMB !== undefined
                            ? `~${Math.round(model.vramRequiredMB)} MiB runtime GPU memory`
                            : 'GPU memory estimate unavailable'}
                          {model.lowResourceRequired ? ' · low-resource profile' : ''}
                        </span>
                      </div>
                      <button type="button" className="ai-set-default-btn" disabled={alreadyAdded}
                        onClick={() => void addPrebuiltLocalModel(model.id)}>
                        {alreadyAdded ? 'In picker' : 'Add & select'}
                      </button>
                    </div>
                  );
                })}
                {prebuiltModelsLoaded && filteredPrebuiltModels.length === 0 && <p>No matching models in this pinned registry.</p>}
              </div>
              {filteredPrebuiltModels.length > 0 && <p className="ai-key-note">Showing up to 8 matching entries. Add a model, then use Download &amp; load in the AI panel. Repository: {filteredPrebuiltModels[0].repository}</p>}
            </section>

            <section className="ai-transformers-model-section">
              <h3 style={{ margin: '0 0 0.5rem' }}>Public Transformers.js model repository</h3>
              <div className="ai-key-row">
                <label htmlFor="transformers-model-repository">Hugging Face owner/model</label>
                <input id="transformers-model-repository" value={transformersRepositoryId}
                  onChange={e => setTransformersRepositoryId(e.target.value)}
                  placeholder="Xenova/Qwen2.5-Coder-0.5B-Instruct" autoCapitalize="none" autoCorrect="off" />
              </div>
              <button type="button" className="ai-send-btn" onClick={addTransformersModel}
                disabled={!transformersRepositoryId.trim()}>
                Add compatible HF model
              </button>
              <p className="ai-key-note">
                The repository must be public and contain ONNX model artifacts supported by Transformers.js for text generation. This field accepts only an owner/model ID, not a URL, private repository, GGUF file, or arbitrary model format. The repository is not verified until you prepare it; unsupported models will show a loader error.
              </p>
            </section>

            <section style={{ borderTop: '1px solid var(--color-border)', marginTop: '1rem', paddingTop: '1rem' }}>
              <h3 style={{ margin: '0 0 0.5rem' }}>Custom OpenAI-compatible model server</h3>
              <div className="ai-key-row">
                <label htmlFor="custom-model-label">Label</label>
                <input id="custom-model-label" value={customEndpointForm.label}
                  onChange={e => setCustomEndpointForm(form => ({ ...form, label: e.target.value }))}
                  placeholder="My model server" />
              </div>
              <div className="ai-key-row">
                <label htmlFor="custom-model-url">Base URL</label>
                <input id="custom-model-url" type="url" value={customEndpointForm.baseUrl}
                  onChange={e => setCustomEndpointForm(form => ({ ...form, baseUrl: e.target.value }))}
                  placeholder="https://your-server.example/v1" autoComplete="url" />
              </div>
              <div className="ai-key-row">
                <label htmlFor="custom-model-id">Exact model ID</label>
                <input id="custom-model-id" value={customEndpointForm.model}
                  onChange={e => setCustomEndpointForm(form => ({ ...form, model: e.target.value }))}
                  placeholder="qwen2.5-coder:7b" />
              </div>
              <div className="ai-key-row">
                <label htmlFor="custom-model-key">API key (optional)</label>
                <input id="custom-model-key" type="password" value={customEndpointForm.apiKey}
                  onChange={e => setCustomEndpointForm(form => ({ ...form, apiKey: e.target.value }))}
                  placeholder="Optional; stored encrypted in this browser" autoComplete="new-password" />
              </div>
              <button className="ai-send-btn" onClick={saveCustomEndpoint}>Save custom endpoint</button>
              {customEndpointConfigured && (
                <button className="ai-clear-btn" onClick={removeCustomEndpoint}>Remove custom endpoint</button>
              )}
              <p className="ai-key-note">
                Your prompt and code snippets go to this server. Use only a server you trust; remote URLs must use HTTPS and permit this app through CORS. This connects to a model your server already serves—it does not download weights into the browser.
              </p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
