// AIGateway.ts — 13 models, multi-provider streaming, tool-calling loop (Sprint 12)
import { mcpClient } from './MCPClient';

export type Provider = 'webllm' | 'groq' | 'openai' | 'anthropic' | 'openrouter';

export interface ModelConfig {
  id: string; label: string; provider: Provider;
  contextWindow: number; free: boolean; offlineCapable: boolean;
  supportsTools?: boolean;
}

export const MODELS: ModelConfig[] = [
  { id: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen 1.5B (local)',      provider: 'webllm',    contextWindow: 32768,  free: true,  offlineCapable: true,  supportsTools: true  },
  { id: 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen 0.5B (local)',      provider: 'webllm',    contextWindow: 32768,  free: true,  offlineCapable: true,  supportsTools: true  },
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',        label: 'Phi 3.5 Mini (local)',   provider: 'webllm',    contextWindow: 128000, free: true,  offlineCapable: true,  supportsTools: false },
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
];

export interface Message { role: 'user' | 'assistant' | 'system' | 'tool'; content: string; tool_call_id?: string; tool_name?: string; }
export interface StreamChunk { delta: string; done: boolean; toolCall?: ToolCallEvent; }
export interface ToolCallEvent { id: string; name: string; args: Record<string, unknown>; serverId: string; result?: string; }

type StreamHandler = (chunk: StreamChunk) => void;

class AIGateway {
  private modelId = MODELS[0].id;
  private keys: Partial<Record<Provider, string>> = {};

  setModel(id: string)                             { this.modelId = id; }
  getModel()                                       { return MODELS.find(m => m.id === this.modelId) ?? MODELS[0]; }
  setKey(provider: Provider, key: string)          { this.keys[provider] = key; localStorage.setItem(`devnoder-key-${provider}`, key); }
  loadKeys()                                       { (['groq','openai','anthropic','openrouter'] as Provider[]).forEach(p => { const k = localStorage.getItem(`devnoder-key-${p}`); if (k) this.keys[p] = k; }); }

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
      default:           onChunk({ delta: 'No API key configured.', done: true });
    }
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

        const reader = res.body!.getReader();
        const dec    = new TextDecoder();
        let   toolUseBlock: any = null;
        let   toolInputRaw = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of dec.decode(value).split('\n').filter(l => l.startsWith('data: '))) {
            try {
              const j = JSON.parse(line.slice(6));
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
            } catch { /* skip */ }
          }
        }
      } catch (e: any) { if (e.name !== 'AbortError') onChunk({ delta: `Error: ${e.message}`, done: true }); }
    }
  }

  // ── OpenAI/Groq — tool loop ────────────────────────────────────────────────
  private async _streamOpenAI(url: string, key: string, messages: Message[], onChunk: StreamHandler, signal?: AbortSignal, tools: any[] = []) {
    if (!key) { onChunk({ delta: 'API key not set. Add it in Settings.', done: true }); return; }
    const openAITools = mcpClient.toOpenAITools(tools);
    let   history     = messages.filter(m => m.role !== 'tool');
    let   continueLoop = true;

    while (continueLoop) {
      continueLoop = false;
      try {
        const res = await fetch(url, {
          method: 'POST', signal,
          headers: { 'Content-Type':'application/json', Authorization: `Bearer ${key}`, 'HTTP-Referer':'https://devnoder.srvel.io' },
          body: JSON.stringify({
            model: this.modelId, messages: history, stream: true, max_tokens: 4096,
            ...(openAITools.length && { tools: openAITools, tool_choice: 'auto' }),
          }),
        });
        if (!res.ok) { onChunk({ delta: `API error ${res.status}`, done: true }); return; }

        const reader = res.body!.getReader();
        const dec    = new TextDecoder();
        let   pendingToolCalls: Record<string, { id: string; name: string; argsRaw: string }> = {};

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of dec.decode(value).split('\n').filter(l => l.startsWith('data: '))) {
            const data = line.slice(6);
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
            } catch { /* skip */ }
          }
        }
      } catch (e: any) { if (e.name !== 'AbortError') onChunk({ delta: `Error: ${e.message}`, done: true }); }
    }
  }
}

export const aiGateway = new AIGateway();
