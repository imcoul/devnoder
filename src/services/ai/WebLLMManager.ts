// WebLLMManager.ts — WebGPU + Transformers.js fallback + local tool calling via prompt injection
import type { Message, StreamChunk, ToolCallEvent } from './AIGateway';
import type { MCPTool } from './MCPConfigStore';

type StreamHandler = (chunk: StreamChunk) => void;

class WebLLMManager {
  private engine: any = null;
  private currentModelId = '';
  private loadingProgress = 0;
  private onProgressCbs: Array<(p: number, label: string) => void> = [];
  private useTransformers = false;
  private tfPipeline: any = null;

  onProgress(cb: (p: number, label: string) => void) { this.onProgressCbs.push(cb); }
  getProgress() { return this.loadingProgress; }

  private emitProgress(p: number, label: string) {
    this.loadingProgress = p;
    this.onProgressCbs.forEach(cb => cb(p, label));
  }

  async load(modelId: string): Promise<void> {
    if (this.currentModelId === modelId && (this.engine || this.tfPipeline)) return;

    const { MODELS } = await import('./AIGateway');
    const model = MODELS.find(candidate => candidate.id === modelId);
    if (!model?.offlineCapable) throw new Error(`Unknown on-device model: ${modelId}`);

    if (typeof navigator !== 'undefined' && 'gpu' in navigator && model.provider === 'webllm') {
      try {
        const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
        const engine = await CreateMLCEngine(modelId, {
          initProgressCallback: (info: any) => {
            this.emitProgress(Math.round((info.progress ?? 0) * 100), info.text ?? 'Loading…');
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
    this.emitProgress(10, 'Loading Transformers.js…');
    const { pipeline } = await import('@huggingface/transformers');
    this.emitProgress(30, 'Downloading model weights…');
    const loadedPipeline = await pipeline('text-generation', model.transformersModelId, {
      progress_callback: (info: any) => {
        if (info.status === 'progress')
          this.emitProgress(30 + Math.round(info.progress * 0.6), `Downloading ${info.file}…`);
      },
    });
    this.tfPipeline = loadedPipeline;
    this.emitProgress(100, 'Ready');
    this.currentModelId = modelId;
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
      const prompt = augmented.map(m => `${m.role}: ${m.content}`).join('\n') + '\nassistant:';
      const result = await this.tfPipeline(prompt, { max_new_tokens: 512 });
      const generated = result[0]?.generated_text ?? '';
      const text = (generated.startsWith(prompt) ? generated.slice(prompt.length) : generated).trim();

      const toolCall = this.parseToolCall(text);
      if (toolCall && tools.length) {
        await this._handleLocalToolCall(toolCall, tools, onChunk);
        return;
      }

      const words = text.split(' ');
      for (const word of words) {
        if (signal?.aborted) break;
        onChunk({ delta: word + ' ', done: false });
        await new Promise(r => setTimeout(r, 20));
      }
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
  unload()   { this.engine = null; this.tfPipeline = null; this.currentModelId = ''; this.useTransformers = false; }
}

export const webLLMManager = new WebLLMManager();
