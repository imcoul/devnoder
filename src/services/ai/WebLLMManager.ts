// WebLLMManager.ts — WebGPU + Transformers.js fallback + local tool calling via prompt injection
import type { Message, StreamChunk, ToolCallEvent } from './AIGateway';
import type { MCPTool } from './MCPConfigStore';

type StreamHandler = (chunk: StreamChunk) => void;

export type LocalModelPreparationState = 'not-prepared' | 'downloading' | 'ready-in-tab';

class WebLLMManager {
  private engine: any = null;
  private currentModelId = '';
  private loadingProgress = 0;
  private onProgressCbs = new Set<(p: number, label: string, modelId: string) => void>();
  private useTransformers = false;
  private tfPipeline: any = null;
  private loadingPromise: Promise<void> | null = null;
  private loadingModelId = '';

  onProgress(cb: (p: number, label: string, modelId: string) => void) {
    this.onProgressCbs.add(cb);
    return () => { this.onProgressCbs.delete(cb); };
  }
  getProgress() { return this.loadingProgress; }

  getPreparationState(modelId: string): LocalModelPreparationState {
    if (this.currentModelId === modelId && (this.engine || this.tfPipeline)) return 'ready-in-tab';
    if (this.loadingModelId === modelId && this.loadingPromise) return 'downloading';
    return 'not-prepared';
  }

  private emitProgress(p: number, label: string, modelId = this.loadingModelId || this.currentModelId) {
    this.loadingProgress = Math.max(0, Math.min(100, Number.isFinite(p) ? p : 0));
    this.onProgressCbs.forEach(cb => cb(this.loadingProgress, label, modelId));
  }

  async load(modelId: string): Promise<void> {
    if (this.currentModelId === modelId && (this.engine || this.tfPipeline)) return;
    if (this.loadingPromise) {
      if (this.loadingModelId === modelId) return this.loadingPromise;
      throw new Error('Another local model is currently loading. Wait for it to finish before switching models.');
    }
    if (this.currentModelId && (this.engine || this.tfPipeline)) await this.unload();

    this.loadingModelId = modelId;
    const task = this.loadModel(modelId);
    this.loadingPromise = task;
    try {
      await task;
    } finally {
      if (this.loadingPromise === task) {
        this.loadingPromise = null;
        this.loadingModelId = '';
      }
    }
  }

  private async loadModel(modelId: string): Promise<void> {
    const { aiGateway } = await import('./AIGateway');
    const model = aiGateway.getModels().find(candidate => candidate.id === modelId);
    if (!model?.offlineCapable) throw new Error(`Unknown on-device model: ${modelId}`);
    const webgpuAvailable = typeof navigator !== 'undefined' && 'gpu' in navigator;

    if (webgpuAvailable && model.provider === 'webllm') {
      try {
        const { CreateMLCEngine, prebuiltAppConfig } = await import('@mlc-ai/web-llm');
        if (!prebuiltAppConfig.model_list.some(entry => entry.model_id === modelId && (entry.model_type == null || entry.model_type === 0))) {
          throw new Error('This model is not in the installed WebLLM prebuilt registry.');
        }
        const engine = await CreateMLCEngine(modelId, {
          initProgressCallback: (info: any) => {
            this.emitProgress(Math.round((info.progress ?? 0) * 100), info.text ?? 'Downloading model files…', modelId);
          },
        });
        this.engine = engine;
        this.tfPipeline = null;
        this.currentModelId = modelId;
        this.useTransformers = false;
        return;
      } catch (e) {
        this.engine = null;
        if (!model.transformersModelId) {
          const reason = e instanceof Error ? ` (${e.message})` : '';
          throw new Error(`${model.label} could not load with WebGPU${reason}. Try Qwen 0.5B (local), the supported WASM model.`, { cause: e });
        }
      }
    }

    // Only use a fallback whose exact model repository is declared by the
    // selected catalog entry. Never run a different model under its label.
    if (!model.transformersModelId) {
      throw new Error(`${model.label} requires a compatible WebGPU device. Choose Qwen 0.5B (local) for the supported WASM fallback.`);
    }

    this.useTransformers = true;
    this.engine = null;
    this.emitProgress(0, 'Preparing the supported Transformers.js model…', modelId);
    const { pipeline } = await import('@huggingface/transformers');
    this.emitProgress(5, 'Downloading model files from Hugging Face…', modelId);
    const loadedPipeline = await pipeline('text-generation', model.transformersModelId, {
      ...(model.transformersDtype ? { dtype: model.transformersDtype } : {}),
      progress_callback: (info: any) => {
        if (info.status === 'progress') {
          // Transformers.js reports percentages (0..100), not fractions.
          const progress = Number.isFinite(info.progress) ? Math.round(5 + info.progress * 0.85) : 5;
          const file = typeof info.file === 'string' ? info.file : 'model files';
          this.emitProgress(progress, `Downloading ${file}…`, modelId);
        } else if (info.status === 'done') {
          this.emitProgress(92, 'Model files cached; initializing runtime…', modelId);
        }
      },
    });
    this.tfPipeline = loadedPipeline;
    this.emitProgress(100, 'Ready in this tab', modelId);
    this.currentModelId = modelId;
  }

  isLoadedFor(modelId: string): boolean {
    return this.currentModelId === modelId && !!(this.engine || this.tfPipeline);
  }

  async hasCachedModelFiles(modelId: string): Promise<boolean | null> {
    const { aiGateway } = await import('./AIGateway');
    const model = aiGateway.getModels().find(candidate => candidate.id === modelId);
    if (!model?.offlineCapable) return null;
    let found = false;
    let inspected = false;

    if (model.provider === 'webllm') {
      try {
        const { hasModelInCache } = await import('@mlc-ai/web-llm');
        found = await hasModelInCache(modelId);
        inspected = true;
      } catch {
        // Cache backend can be unavailable in private browsing or restricted contexts.
      }
    }

    if (model.transformersModelId && typeof caches !== 'undefined') {
      try {
        const { env } = await import('@huggingface/transformers');
        if (env.useBrowserCache) {
          const cache = await caches.open(env.cacheKey);
          const repoPath = `/${model.transformersModelId}/resolve/`;
          const keys = await cache.keys();
          found = found || keys.some(request => new URL(request.url).pathname.includes(repoPath));
          inspected = true;
        }
      } catch {
        // Cache inspection is best-effort; a successful model load remains authoritative.
      }
    }
    return inspected ? found : null;
  }

  async deleteCachedModelFiles(modelId: string): Promise<void> {
    if (this.loadingModelId === modelId) throw new Error('Wait for the model download to finish before clearing its cache.');
    if (this.currentModelId === modelId) await this.unload();
    const { aiGateway } = await import('./AIGateway');
    const model = aiGateway.getModels().find(candidate => candidate.id === modelId);
    if (!model?.offlineCapable) throw new Error(`Unknown on-device model: ${modelId}`);

    if (model.provider === 'webllm') {
      const { deleteModelInCache } = await import('@mlc-ai/web-llm');
      await deleteModelInCache(modelId);
    }

    if (model.transformersModelId && typeof caches !== 'undefined') {
      const { env } = await import('@huggingface/transformers');
      if (env.useBrowserCache) {
        const cache = await caches.open(env.cacheKey);
        const repoPath = `/${model.transformersModelId}/resolve/`;
        const keys = await cache.keys();
        await Promise.all(keys.filter(request => new URL(request.url).pathname.includes(repoPath))
          .map(request => cache.delete(request)));
      }
    }
  }

  // ── Tool calling via prompt injection for local models ────────────────────
  private buildToolPrompt(tools: MCPTool[]): string {
    if (!tools.length) return '';
    const toolDefs = tools.map(t =>
      `- ${t.name}: ${t.description}\n  Input: ${JSON.stringify(t.inputSchema)}`
    ).join('\n');
    return `\n\nYou have access to these tools. To call a tool, respond with:\n<tool_call>\n{"name": "tool_name", "arguments": {...}}\n</tool_call>\n\nAvailable tools:\n${toolDefs}\n`;
  }

  private parseToolCall(text: string): { name: string; arguments: Record<string, unknown> } | null {
    const match = text.match(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/);
    if (!match) return null;
    try { return JSON.parse(match[1]); } catch { return null; }
  }

  async stream(
    modelId: string,
    messages: Message[],
    onChunk: StreamHandler,
    signal?: AbortSignal,
    tools: MCPTool[] = [],
  ): Promise<void> {
    await this.load(modelId);

    // Inject tool definitions into system message
    const toolPrompt = this.buildToolPrompt(tools);
    const augmented: Message[] = toolPrompt
      ? messages.map((m, i) => i === 0 && m.role === 'system'
          ? { ...m, content: m.content + toolPrompt }
          : m)
      : messages;

    if (this.useTransformers && this.tfPipeline) {
      const chat = augmented.map(m => ({ role: m.role, content: m.content }));
      let result: any;
      let rawPrompt = '';
      if (signal?.aborted) { onChunk({ delta: '', done: true }); return; }
      try {
        result = await this.tfPipeline(chat, { max_new_tokens: 512, do_sample: false });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/chat.?template|apply_chat_template/i.test(message)) throw error;
        const prompt = augmented.map(m => `${m.role}: ${m.content}`).join('\n') + '\nassistant:';
        rawPrompt = prompt;
        result = await this.tfPipeline(prompt, { max_new_tokens: 512, do_sample: false });
      }
      const generated = result[0]?.generated_text;
      const finalMessage = Array.isArray(generated) ? generated.at(-1) : generated;
      const text = typeof finalMessage === 'string'
        ? (rawPrompt && finalMessage.startsWith(rawPrompt) ? finalMessage.slice(rawPrompt.length) : finalMessage).trim()
        : typeof finalMessage?.content === 'string'
          ? finalMessage.content.trim()
          : '';

      const toolCall = this.parseToolCall(text);
      if (toolCall && tools.length) {
        await this._handleLocalToolCall(toolCall, tools, onChunk);
        return;
      }

      // Return actual completed WASM output; do not simulate token streaming.
      if (!signal?.aborted) onChunk({ delta: text, done: false });
      onChunk({ delta: '', done: true });
      return;
    }

    if (this.engine) {
      const chunks = await this.engine.chat.completions.create({
        messages: augmented, stream: true, temperature: 0.7, max_tokens: 2048,
      });
      let fullText = '';
      for await (const chunk of chunks) {
        if (signal?.aborted) break;
        const delta = chunk.choices[0]?.delta?.content ?? '';
        fullText += delta;
        onChunk({ delta, done: false });
      }

      const toolCall = this.parseToolCall(fullText);
      if (toolCall && tools.length) {
        await this._handleLocalToolCall(toolCall, tools, onChunk);
        return;
      }

      onChunk({ delta: '', done: true });
    }
  }

  private async _handleLocalToolCall(
    call: { name: string; arguments: Record<string, unknown> },
    tools: MCPTool[],
    onChunk: StreamHandler,
  ) {
    const { mcpClient } = await import('./MCPClient');
    const tool = tools.find(t => t.name === call.name);
    if (!tool) { onChunk({ delta: `\n[Unknown tool: ${call.name}]`, done: true }); return; }

    const evt: ToolCallEvent = { id: crypto.randomUUID(), name: call.name, args: call.arguments, serverId: tool.serverId };
    onChunk({ delta: '', done: false, toolCall: evt });

    try {
      const result = await mcpClient.callTool({ serverId: tool.serverId, toolName: call.name, args: call.arguments });
      evt.result = mcpClient.resultToText(result);
      onChunk({ delta: '', done: false, toolCall: evt });
      // Respond with result as plain text continuation
      onChunk({ delta: `\n\nTool result:\n${evt.result}`, done: true });
    } catch (e: any) {
      onChunk({ delta: `\n[Tool error: ${e.message}]`, done: true });
    }
  }

  isLoaded() { return !!(this.engine || this.tfPipeline); }
  async unload(): Promise<void> {
    if (this.loadingPromise) throw new Error('Wait for the model loading operation to finish before unloading.');
    if (this.engine?.unload) await this.engine.unload();
    if (this.tfPipeline?.dispose) await this.tfPipeline.dispose();
    this.engine = null;
    this.tfPipeline = null;
    this.currentModelId = '';
    this.useTransformers = false;
    this.loadingProgress = 0;
  }
}

export const webLLMManager = new WebLLMManager();
