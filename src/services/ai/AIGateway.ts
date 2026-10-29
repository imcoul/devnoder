// AIGateway.ts — 13 models, multi-provider streaming, tool-calling loop (Sprint 12)
import { mcpClient } from './MCPClient';
import { cryptoVault } from '../security/CryptoVault';
import {
  isValidTransformersRepoId,
  readSavedLocalModels,
  writeSavedLocalModels,
} from './LocalModelCatalog';

export type Provider = 'webllm' | 'transformers' | 'groq' | 'openai' | 'anthropic' | 'openrouter' | 'litellm' | 'openai-compatible';

export interface ModelConfig {
  id: string; label: string; provider: Provider;
  contextWindow: number; free: boolean; offlineCapable: boolean;
  supportsTools?: boolean;
  /** Exact Hugging Face model used when this selection has a supported WASM path. */
  transformersModelId?: string;
  /** Optional Transformers.js dtype verified for the declared repository. */
  transformersDtype?: 'q4' | 'q8';
  /** Runtime-published VRAM estimate in MiB; not a model download-size estimate. */
  vramRequiredMB?: number;
  lowResourceRequired?: boolean;
}

export const MODELS: ModelConfig[] = [
  { id: 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen 0.5B (local)',      provider: 'webllm',    contextWindow: 32768,  free: true,  offlineCapable: true,  supportsTools: true, transformersModelId: 'onnx-community/Qwen2.5-Coder-0.5B-Instruct', transformersDtype: 'q8', vramRequiredMB: 944.62, lowResourceRequired: true },
  { id: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen 1.5B (WebGPU)',     provider: 'webllm',    contextWindow: 32768,  free: true,  offlineCapable: true,  supportsTools: true, vramRequiredMB: 1629.75, lowResourceRequired: false },
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',        label: 'Phi 3.5 Mini (local)',   provider: 'webllm',    contextWindow: 128000, free: true,  offlineCapable: true,  supportsTools: false, vramRequiredMB: 3672.07, lowResourceRequired: false },
  { id: 'llama-3.1-8b-instant',                     label: 'Llama 3.1 8B (Groq)',    provider: 'groq',      contextWindow: 131072, free: true,  offlineCapable: false, supportsTools: true  },
  { id: 'llama-3.3-70b-versatile',                  label: 'Llama 3.3 70B (Groq)',   provider: 'groq',      contextWindow: 131072, free: true,  offlineCapable: false, supportsTools: true  },
  { id: 'mixtral-8x7b-32768',                       label: 'Mixtral 8x7B (Groq)',    provider: 'groq',      contextWindow: 32768,  free: true,  offlineCapable: false, supportsTools: true  },
  { id: 'gemma2-9b-it',                             label: 'Gemma 2 9B (Groq)',      provider: 'groq',      contextWindow: 8192,   free: true,  offlineCapable: false, supportsTools: false },
  { id: 'gpt-4o-mini',                              label: 'GPT-4o Mini',            provider: 'openai',    contextWindow: 128000, free: false, offlineCapable: false, supportsTools: true  },
  { id: 'gpt-4o',                                   label: 'GPT-4o',                 provider: 'openai',    contextWindow: 128000, free: false, offlineCapable: false, supportsTools: true  },
  { id: 'claude-3-5-haiku-20241022',                label: 'Claude 3.5 Haiku',       provider: 'anthropic', contextWindow: 200000, free: false, offlineCapable: false, supportsTools: true  },
  { id: 'claude-sonnet-4-6',                        label: 'Claude Sonnet 4.6',      provider: 'anthropic', contextWindow: 200000, free: false, offlineCapable: false, supportsTools: true  },
  { id: 'deepseek/deepseek-coder',                  label: 'DeepSeek Coder (OR)',    provider: 'openrouter',contextWindow: 128000, free: true,  offlineCapable: false, supportsTools: false },
  { id: 'meta-llama/llama-3.1-8b-instruct:free',   label: 'Llama 3.1 8B (OR free)', provider: 'openrouter',contextWindow: 131072, free: true,  offlineCapable: false, supportsTools: false },
  { id: 'litellm-proxy',                             label: 'LiteLLM Proxy',           provider: 'litellm',    contextWindow: 131072, free: true,  offlineCapable: false, supportsTools: true  },
];

export interface Message { role: 'user' | 'assistant' | 'system' | 'tool'; content: string; tool_call_id?: string; tool_name?: string; }
export interface StreamChunk { delta: string; done: boolean; toolCall?: ToolCallEvent; }
export interface ToolCallEvent { id: string; name: string; args: Record<string, unknown>; serverId: string; result?: string; }

type StreamHandler = (chunk: StreamChunk) => void;

export interface OpenAICompatibleSettings {
  baseUrl: string;
  model: string;
  label: string;
  hasApiKey: boolean;
}

export interface ModelSetupState {
  kind: 'local' | 'hosted';
  configured: boolean;
  reason: string;
}

interface CustomEndpoint {
  baseUrl: string;
  endpointUrl: string;
  model: string;
  label: string;
}

const CUSTOM_ENDPOINT_KEY = 'devnoder-openai-compatible-endpoint';

function validateEndpointUrl(value: string): { baseUrl: string; endpointUrl: string } {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('Enter a valid HTTPS endpoint URL.'); }
  const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback)) {
    throw new Error('Use HTTPS for a remote model server. Plain HTTP is allowed only for localhost.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Do not put credentials, query parameters, or fragments in the endpoint URL.');
  }
  let path = url.pathname.replace(/\/+$/, '');
  if (!path || path === '/') path = '/v1';
  const endpointPath = path.endsWith('/chat/completions') ? path : `${path}/chat/completions`;
  return { baseUrl: `${url.origin}${path}`, endpointUrl: `${url.origin}${endpointPath}` };
}

async function* readSSEData(body: ReadableStream<Uint8Array> | null): AsyncGenerator<string> {
  if (!body) throw new Error('The model server returned no streaming response body.');
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const dataLines: string[] = [];
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        let line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (!line) {
          if (dataLines.length) yield dataLines.splice(0).join('\n');
        } else if (!line.startsWith(':') && line.startsWith('data:')) {
          dataLines.push(line.slice(5).replace(/^ /, ''));
        }
        newline = buffer.indexOf('\n');
      }
      if (done) break;
    }

    if (buffer) {
      const line = buffer.endsWith('\r') ? buffer.slice(0, -1) : buffer;
      if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
    }
    if (dataLines.length) yield dataLines.join('\n');
  } finally {
    reader.releaseLock();
  }
}

class AIGateway {
  private modelId = MODELS[0].id;
  private keys: Partial<Record<Provider, string>> = {};
  private customEndpoint: CustomEndpoint | null = null;
  private addedLocalModels: ModelConfig[] = [];

  setModel(id: string) {
    this.modelId = this.getModels().some(model => model.id === id) ? id : MODELS[0].id;
  }
  getModels(): ModelConfig[] {
    const models = [...MODELS, ...this.addedLocalModels];
    if (this.customEndpoint) models.push({
      id: 'custom-openai-compatible',
      label: `${this.customEndpoint.label} · ${this.customEndpoint.model}`,
      provider: 'openai-compatible', contextWindow: 32768, free: false,
      offlineCapable: false, supportsTools: false,
    });
    return models;
  }

  async addPrebuiltLocalModel(modelId: string): Promise<ModelConfig> {
    const { listPrebuiltLocalModels } = await import('./LocalModelCatalog');
    const registry = await listPrebuiltLocalModels();
    const entry = registry.find(model => model.id === modelId);
    if (!entry) throw new Error('This model is not in the installed WebLLM prebuilt registry. Arbitrary model files and repositories are not supported.');
    const existing = this.getModels().find(model => model.id === entry.id);
    if (existing) return existing;

    const added: ModelConfig = {
      id: entry.id,
      label: entry.id,
      provider: 'webllm',
      contextWindow: 4096,
      free: true,
      offlineCapable: true,
      vramRequiredMB: entry.vramRequiredMB,
      lowResourceRequired: entry.lowResourceRequired,
    };
    this.addedLocalModels = [...this.addedLocalModels, added];
    writeSavedLocalModels(this.addedLocalModels.map(model => ({
      id: model.id,
      label: model.label,
      provider: model.provider === 'transformers' ? 'transformers' : 'webllm',
      transformersModelId: model.transformersModelId,
      transformersDtype: model.transformersDtype,
      vramRequiredMB: model.vramRequiredMB,
      lowResourceRequired: model.lowResourceRequired,
    })));
    return added;
  }

  addTransformersCompatibleModel(repositoryId: string): ModelConfig {
    const id = repositoryId.trim();
    if (!isValidTransformersRepoId(id)) {
      throw new Error('Enter a Hugging Face repository ID in the form owner/model. URLs, private repositories, and GGUF files are not supported here.');
    }
    const modelId = `transformers:${id}`;
    const existing = this.getModels().find(model => model.id === modelId);
    if (existing) return existing;

    const added: ModelConfig = {
      id: modelId,
      label: `HF · ${id}`,
      provider: 'transformers',
      contextWindow: 2048,
      free: true,
      offlineCapable: true,
      supportsTools: false,
      transformersModelId: id,
      transformersDtype: 'q8',
    };
    this.addedLocalModels = [...this.addedLocalModels, added];
    writeSavedLocalModels(this.addedLocalModels.map(model => ({
      id: model.id,
      label: model.label,
      provider: model.provider === 'transformers' ? 'transformers' : 'webllm',
      transformersModelId: model.transformersModelId,
      transformersDtype: model.transformersDtype,
      vramRequiredMB: model.vramRequiredMB,
      lowResourceRequired: model.lowResourceRequired,
    })));
    return added;
  }

  removePrebuiltLocalModel(modelId: string): void {
    if (MODELS.some(model => model.id === modelId)) {
      throw new Error('Built-in models cannot be removed from the catalog.');
    }
    this.addedLocalModels = this.addedLocalModels.filter(model => model.id !== modelId);
    writeSavedLocalModels(this.addedLocalModels.map(model => ({
      id: model.id,
      label: model.label,
      provider: model.provider === 'transformers' ? 'transformers' : 'webllm',
      transformersModelId: model.transformersModelId,
      transformersDtype: model.transformersDtype,
      vramRequiredMB: model.vramRequiredMB,
      lowResourceRequired: model.lowResourceRequired,
    })));
    if (this.modelId === modelId) this.modelId = MODELS[0].id;
  }

  getModel() { return this.getModels().find(m => m.id === this.modelId) ?? MODELS[0]; }

  hasProviderKey(provider: Provider): boolean {
    return Boolean(this.keys[provider]);
  }

  getModelSetupState(model: ModelConfig = this.getModel()): ModelSetupState {
    if (model.offlineCapable) {
      return {
        kind: 'local',
        configured: true,
        reason: 'Prepare the model in this tab before sending a prompt.',
      };
    }

    if (model.provider === 'openai-compatible') {
      const endpoint = this.getCustomEndpointSettings();
      const localEndpoint = endpoint?.baseUrl.startsWith('http://localhost') || endpoint?.baseUrl.startsWith('http://127.0.0.1');
      const configured = Boolean(endpoint && (endpoint.hasApiKey || localEndpoint));
      return {
        kind: 'hosted',
        configured,
        reason: endpoint
          ? localEndpoint || endpoint.hasApiKey
            ? 'Ready to use the configured model server.'
            : 'Add the server API key before sending a prompt.'
          : 'Configure the trusted model server in AI settings before sending a prompt.',
      };
    }

    const configured = this.hasProviderKey(model.provider);
    return {
      kind: 'hosted',
      configured,
      reason: configured
        ? 'Ready to send through the selected provider.'
        : `Add the ${model.provider} API key in AI settings before sending a prompt.`,
    };
  }

  getCustomEndpointSettings(): OpenAICompatibleSettings | null {
    if (!this.customEndpoint) return null;
    return {
      baseUrl: this.customEndpoint.baseUrl,
      model: this.customEndpoint.model,
      label: this.customEndpoint.label,
      hasApiKey: !!this.keys['openai-compatible'],
    };
  }

  async configureCustomEndpoint(input: {
    baseUrl: string; model: string; label?: string; apiKey?: string;
  }): Promise<void> {
    const model = input.model.trim();
    if (!model) throw new Error('Enter the exact model identifier served by your endpoint.');
    const { baseUrl, endpointUrl } = validateEndpointUrl(input.baseUrl);
    this.customEndpoint = {
      baseUrl,
      endpointUrl,
      model,
      label: input.label?.trim() || 'Custom endpoint',
    };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CUSTOM_ENDPOINT_KEY, JSON.stringify({
        baseUrl: this.customEndpoint.baseUrl,
        model: this.customEndpoint.model,
        label: this.customEndpoint.label,
      }));
    }

    const apiKey = input.apiKey?.trim();
    if (apiKey && !apiKey.startsWith('•')) {
      this.keys['openai-compatible'] = apiKey;
      const encrypted = await cryptoVault.encrypt(apiKey);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('devnoder-key-openai-compatible', encrypted);
      }
    }
  }

  removeCustomEndpoint(): void {
    this.customEndpoint = null;
    delete this.keys['openai-compatible'];
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(CUSTOM_ENDPOINT_KEY);
      localStorage.removeItem('devnoder-key-openai-compatible');
    }
    if (this.modelId === 'custom-openai-compatible') this.modelId = MODELS[0].id;
  }

  setKey(provider: Provider, key: string) {
    this.keys[provider] = key; // kept in memory for the hot request path
    cryptoVault.encrypt(key)
      .then(enc => localStorage.setItem(`devnoder-key-${provider}`, enc))
      .catch(err => console.warn('Failed to encrypt API key at rest:', err));
  }

  async loadKeys(): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    this.addedLocalModels = readSavedLocalModels()
      .filter(model => !MODELS.some(builtIn => builtIn.id === model.id))
      .map(model => ({
        id: model.id,
        label: model.label,
        provider: model.provider === 'transformers' ? 'transformers' as const : 'webllm' as const,
        contextWindow: model.provider === 'transformers' ? 2048 : 4096,
        free: true,
        offlineCapable: true,
        supportsTools: model.provider === 'transformers' ? false : undefined,
        transformersModelId: model.transformersModelId,
        transformersDtype: model.transformersDtype ?? (model.provider === 'transformers' ? 'q8' : undefined),
        vramRequiredMB: model.vramRequiredMB,
        lowResourceRequired: model.lowResourceRequired,
      }));
    for (const p of ['groq', 'openai', 'anthropic', 'openrouter', 'openai-compatible'] as Provider[]) {
      const stored = localStorage.getItem(`devnoder-key-${p}`);
      if (!stored) continue;
      const decrypted = await cryptoVault.decrypt(stored);
      if (decrypted) this.keys[p] = decrypted;
    }
    try {
      const stored = localStorage.getItem(CUSTOM_ENDPOINT_KEY);
      if (!stored) return;
      const config = JSON.parse(stored) as { baseUrl?: string; model?: string; label?: string };
      if (!config.baseUrl || !config.model) return;
      const checked = validateEndpointUrl(config.baseUrl);
      this.customEndpoint = {
        ...checked,
        model: config.model,
        label: config.label?.trim() || 'Custom endpoint',
      };
    } catch (error) {
      localStorage.removeItem(CUSTOM_ENDPOINT_KEY);
      console.warn('Stored custom model endpoint is invalid and was ignored:', error);
    }
  }

  async stream(messages: Message[], onChunk: StreamHandler, signal?: AbortSignal): Promise<void> {
    const model = this.getModel();
    const tools = model.supportsTools ? mcpClient.getAllTools() : [];

    if (model.offlineCapable) {
      const { webLLMManager } = await import('./WebLLMManager');
      return webLLMManager.stream(this.modelId, messages, onChunk, signal, tools);
    }

    switch (model.provider) {
      case 'anthropic':  return this._streamAnthropic(messages, onChunk, signal, tools);
      case 'openai':     return this._streamOpenAI('https://api.openai.com/v1/chat/completions',    this.keys.openai ?? '',    messages, onChunk, signal, tools);
      case 'groq':       return this._streamOpenAI('https://api.groq.com/openai/v1/chat/completions', this.keys.groq ?? '',   messages, onChunk, signal, tools);
      case 'openrouter': return this._streamOpenAI('https://openrouter.ai/api/v1/chat/completions', this.keys.openrouter ?? '', messages, onChunk, signal, []);
      case 'litellm':    return this._streamLiteLLM(messages, onChunk, signal, tools);
      case 'openai-compatible':
        if (!this.customEndpoint) {
          onChunk({ delta: 'Configure a trusted OpenAI-compatible endpoint in AI settings first.', done: true });
          return;
        }
        return this._streamOpenAI(
          this.customEndpoint.endpointUrl,
          this.keys['openai-compatible'] ?? '',
          messages, onChunk, signal, [], this.customEndpoint.model, true,
        );
      default:           onChunk({ delta: 'No API key configured.', done: true });
    }
  }

  private fallbackModelIds: string[] = [];

  setFallbackModelIds(ids: string[]) {
    this.fallbackModelIds = ids.filter(id => this.getModels().some(m => m.id === id));
  }

  async streamWithFallback(messages: Message[], onChunk: StreamHandler, signal?: AbortSignal): Promise<void> {
    const candidates = [this.modelId, ...this.fallbackModelIds.filter(id => id !== this.modelId)];
    const tried = new Set<string>();

    for (const candidate of candidates) {
      if (tried.has(candidate)) continue;
      tried.add(candidate);

      const previous = this.modelId;
      this.setModel(candidate);
      let finalChunk: StreamChunk | undefined;
      const wrapped: StreamHandler = chunk => { finalChunk = chunk; onChunk(chunk); };

      try {
        await this.stream(messages, wrapped, signal);
      } finally {
        if (tried.size > 1) this.setModel(previous);
      }

      const hadError = finalChunk?.done && typeof finalChunk.delta === 'string' && finalChunk.delta.startsWith('Error:');
      if (!hadError) return;
    }

    onChunk({ delta: 'All models failed.', done: true });
  }

  async complete(prompt: string, opts: { maxTokens?: number; temperature?: number } = {}): Promise<string> {
    let result = '';
    await this.stream([{ role: 'user', content: prompt }], chunk => { result += chunk.delta; });
    return result.trim();
  }

  // ── Anthropic — full tool loop ─────────────────────────────────────────────
  private async _streamAnthropic(messages: Message[], onChunk: StreamHandler, signal?: AbortSignal, tools: any[] = []) {
    const key = this.keys.anthropic;
    if (!key) { onChunk({ delta: 'Anthropic API key not set.', done: true }); return; }

    const system  = messages.find(m => m.role === 'system')?.content;
    let   history = messages.filter(m => m.role !== 'system' && m.role !== 'tool');

    const anthropicTools = mcpClient.toAnthropicTools(tools);
    let continueLoop = true;

    while (continueLoop) {
      continueLoop = false;
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST', signal,
          headers: { 'Content-Type':'application/json', 'x-api-key': key, 'anthropic-version':'2023-06-01' },
          body: JSON.stringify({
            model: this.modelId, max_tokens: 4096, stream: true,
            ...(system && { system }),
            messages: history,
            ...(anthropicTools.length && { tools: anthropicTools }),
          }),
        });
        if (!res.ok) { onChunk({ delta: `Anthropic error ${res.status}`, done: true }); return; }

        let   toolUseBlock: any = null;
        let   toolInputRaw = '';

        for await (const data of readSSEData(res.body)) {
          if (!data || data === '[DONE]') continue;
          try {
              const j = JSON.parse(data);
              if (j.type === 'content_block_start' && j.content_block?.type === 'tool_use') {
                toolUseBlock = j.content_block;
                toolInputRaw = '';
              }
              if (j.type === 'content_block_delta') {
                if (j.delta?.type === 'text_delta') onChunk({ delta: j.delta.text ?? '', done: false });
                if (j.delta?.type === 'input_json_delta') toolInputRaw += j.delta.partial_json ?? '';
              }
              if (j.type === 'content_block_stop' && toolUseBlock) {
                // Execute tool
                const args = JSON.parse(toolInputRaw || '{}');
                const tool = tools.find(t => t.name === toolUseBlock.name);
                if (tool) {
                  const evt: ToolCallEvent = { id: toolUseBlock.id, name: tool.name, args, serverId: tool.serverId };
                  onChunk({ delta: '', done: false, toolCall: evt });
                  try {
                    const result = await mcpClient.callTool({ serverId: tool.serverId, toolName: tool.name, args });
                    const resultText = mcpClient.resultToText(result);
                    evt.result = resultText;
                    onChunk({ delta: '', done: false, toolCall: evt });
                    // Append tool result to history and continue
                    history = [...history,
                      { role: 'assistant', content: JSON.stringify([{ type: 'tool_use', id: toolUseBlock.id, name: tool.name, input: args }]) },
                      { role: 'user', content: JSON.stringify([{ type: 'tool_result', tool_use_id: toolUseBlock.id, content: resultText }]) },
                    ];
                    continueLoop = true;
                  } catch (e: any) { onChunk({ delta: `\n[Tool error: ${e.message}]`, done: false }); }
                }
                toolUseBlock = null;
              }
              if (j.type === 'message_stop') { onChunk({ delta: '', done: true }); }
          } catch { /* skip malformed/unknown provider events */ }
        }
      } catch (e: any) { if (e.name !== 'AbortError') onChunk({ delta: `Error: ${e.message}`, done: true }); }
    }
  }

  // ── OpenAI/Groq — tool loop ────────────────────────────────────────────────
  private async _streamOpenAI(url: string, key: string, messages: Message[], onChunk: StreamHandler, signal?: AbortSignal, tools: any[] = [], modelId = this.modelId, allowUnauthenticated = false) {
    if (!key && !allowUnauthenticated) { onChunk({ delta: 'API key not set. Add it in Settings.', done: true }); return; }
    const openAITools = mcpClient.toOpenAITools(tools);
    let   history     = messages.filter(m => m.role !== 'tool');
    let   continueLoop = true;

    while (continueLoop) {
      continueLoop = false;
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (key) headers.Authorization = `Bearer ${key}`;
        const res = await fetch(url, {
          method: 'POST', signal,
          headers,
          body: JSON.stringify({
            model: modelId, messages: history, stream: true, max_tokens: 4096,
            ...(openAITools.length && { tools: openAITools, tool_choice: 'auto' }),
          }),
        });
        if (!res.ok) { onChunk({ delta: `API error ${res.status}`, done: true }); return; }

        let   pendingToolCalls: Record<string, { id: string; name: string; argsRaw: string }> = {};

        for await (const data of readSSEData(res.body)) {
          if (!data) continue;
            if (data === '[DONE]') {
              // Process any pending tool calls
              if (Object.keys(pendingToolCalls).length) {
                for (const tc of Object.values(pendingToolCalls)) {
                  const tool = tools.find(t => t.name === tc.name);
                  if (!tool) continue;
                  const args = JSON.parse(tc.argsRaw || '{}');
                  const evt: ToolCallEvent = { id: tc.id, name: tc.name, args, serverId: tool.serverId };
                  onChunk({ delta: '', done: false, toolCall: evt });
                  try {
                    const result = await mcpClient.callTool({ serverId: tool.serverId, toolName: tc.name, args });
                    const resultText = mcpClient.resultToText(result);
                    evt.result = resultText;
                    onChunk({ delta: '', done: false, toolCall: evt });
                    history = [...history,
                      { role: 'assistant', content: JSON.stringify({ tool_calls: [{ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.argsRaw } }] }) },
                      { role: 'tool', content: resultText, tool_call_id: tc.id, tool_name: tc.name },
                    ];
                    continueLoop = true;
                  } catch (e: any) { onChunk({ delta: `\n[Tool error: ${e.message}]`, done: false }); }
                }
                pendingToolCalls = {};
              } else {
                onChunk({ delta: '', done: true });
              }
              return;
            }
            try {
              const j = JSON.parse(data);
              const delta = j.choices?.[0]?.delta;
              if (delta?.content) onChunk({ delta: delta.content, done: false });
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0;
                  if (!pendingToolCalls[idx]) pendingToolCalls[idx] = { id: tc.id ?? '', name: '', argsRaw: '' };
                  if (tc.id) pendingToolCalls[idx].id = tc.id;
                  if (tc.function?.name) pendingToolCalls[idx].name = tc.function.name;
                  if (tc.function?.arguments) pendingToolCalls[idx].argsRaw += tc.function.arguments;
                }
              }
            } catch { /* skip malformed/unknown provider events */ }
        }
      } catch (e: any) { if (e.name !== 'AbortError') onChunk({ delta: `Error: ${e.message}`, done: true }); }
    }
  }

  // ── LiteLLM Proxy — OpenAI-compatible streaming ────────────────────────────
  private async _streamLiteLLM(messages: Message[], onChunk: StreamHandler, signal?: AbortSignal, tools: any[] = []) {
    const baseUrl = this.keys.litellm ?? 'http://localhost:4000';
    const url = `${baseUrl}/v1/chat/completions`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.keys.litellm) headers['Authorization'] = `Bearer ${this.keys.litellm}`;
    const openAITools = mcpClient.toOpenAITools(tools);
    let history = messages.filter(m => m.role !== 'tool');
    let continueLoop = true;

    while (continueLoop) {
      continueLoop = false;
      try {
        const res = await fetch(url, {
          method: 'POST', signal, headers,
          body: JSON.stringify({
            model: this.modelId, messages: history, stream: true, max_tokens: 4096,
            ...(openAITools.length && { tools: openAITools, tool_choice: 'auto' }),
          }),
        });
        if (!res.ok) { onChunk({ delta: `LiteLLM error ${res.status}`, done: true }); return; }

        let pendingToolCalls: Record<string, { id: string; name: string; argsRaw: string }> = {};

        for await (const data of readSSEData(res.body)) {
          if (!data) continue;
            if (data === '[DONE]') {
              if (Object.keys(pendingToolCalls).length) {
                for (const tc of Object.values(pendingToolCalls)) {
                  const tool = tools.find(t => t.name === tc.name);
                  if (!tool) continue;
                  const args = JSON.parse(tc.argsRaw || '{}');
                  const evt: ToolCallEvent = { id: tc.id, name: tc.name, args, serverId: tool.serverId };
                  onChunk({ delta: '', done: false, toolCall: evt });
                  try {
                    const result = await mcpClient.callTool({ serverId: tool.serverId, toolName: tc.name, args });
                    const resultText = mcpClient.resultToText(result);
                    evt.result = resultText;
                    onChunk({ delta: '', done: false, toolCall: evt });
                    history = [...history,
                      { role: 'assistant', content: JSON.stringify({ tool_calls: [{ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.argsRaw } }] }) },
                      { role: 'tool', content: resultText, tool_call_id: tc.id, tool_name: tc.name },
                    ];
                    continueLoop = true;
                  } catch (e: any) { onChunk({ delta: `\n[Tool error: ${e.message}]`, done: false }); }
                }
                pendingToolCalls = {};
              } else {
                onChunk({ delta: '', done: true });
              }
              return;
            }
            try {
              const j = JSON.parse(data);
              const delta = j.choices?.[0]?.delta;
              if (delta?.content) onChunk({ delta: delta.content, done: false });
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0;
                  if (!pendingToolCalls[idx]) pendingToolCalls[idx] = { id: tc.id ?? '', name: '', argsRaw: '' };
                  if (tc.id) pendingToolCalls[idx].id = tc.id;
                  if (tc.function?.name) pendingToolCalls[idx].name = tc.function.name;
                  if (tc.function?.arguments) pendingToolCalls[idx].argsRaw += tc.function.arguments;
                }
              }
            } catch { /* skip malformed/unknown provider events */ }
        }
      } catch (e: any) { if (e.name !== 'AbortError') onChunk({ delta: `Error: ${e.message}`, done: true }); }
    }
  }
}

export const aiGateway = new AIGateway();
