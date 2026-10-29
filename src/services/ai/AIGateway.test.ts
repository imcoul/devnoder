import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const vault = vi.hoisted(() => ({
  encrypt: vi.fn(async (value: string) => `encrypted:${value}`),
  decrypt: vi.fn(async (value: string) => value.startsWith('encrypted:') ? value.slice('encrypted:'.length) : null),
}));
const webllm = vi.hoisted(() => ({
  models: [
    { model_id: 'org/approved-chat-model', model: 'https://huggingface.co/org/approved-chat-model', model_type: 0, vram_required_MB: 1536, low_resource_required: true },
    { model_id: 'org/vision-model', model: 'https://huggingface.co/org/vision-model', model_type: 2, vram_required_MB: 4096 },
  ],
}));

vi.mock('../security/CryptoVault', () => ({ cryptoVault: vault }));
vi.mock('@mlc-ai/web-llm', () => ({ prebuiltAppConfig: { model_list: webllm.models }, ModelType: { LLM: 0 } }));

import { aiGateway, MODELS } from './AIGateway';

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, String(value)); },
  removeItem: (key: string) => { values.delete(key); },
  clear: () => values.clear(),
};

function responseWithSSE() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"hello"}}]}\n\n'));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

function responseWithChunkedSSE() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of [
        'data: {"choices":[{"delta":{"content":"hel',
        'lo"}}]}\r\n',
        '\r\n',
        'data: [DONE]\n\n',
      ]) {
        controller.enqueue(encoder.encode(chunk));
        await Promise.resolve();
      }
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

describe('AIGateway custom OpenAI-compatible endpoint', () => {
  const fetchMock = vi.fn();

  beforeEach(async () => {
    values.clear();
    vault.encrypt.mockClear();
    vault.decrypt.mockClear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(responseWithSSE());
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('fetch', fetchMock);
    aiGateway.removeCustomEndpoint();
    await aiGateway.loadKeys();
    aiGateway.setModel(MODELS[0].id);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('requires HTTPS for remote servers and rejects embedded credentials or query parameters', async () => {
    await expect(aiGateway.configureCustomEndpoint({
      baseUrl: 'http://model.example/v1', model: 'some-model',
    })).rejects.toThrow('Use HTTPS');
    await expect(aiGateway.configureCustomEndpoint({
      baseUrl: 'https://user:pass@model.example/v1', model: 'some-model',
    })).rejects.toThrow('credentials');
    await expect(aiGateway.configureCustomEndpoint({
      baseUrl: 'https://model.example/v1?token=secret', model: 'some-model',
    })).rejects.toThrow('query parameters');
  });

  it('saves a user endpoint without storing its API key in plaintext', async () => {
    await aiGateway.configureCustomEndpoint({
      label: 'My server', baseUrl: 'https://model.example/v1',
      model: 'org/code-model', apiKey: 'secret-token',
    });

    expect(aiGateway.getModels().at(-1)).toMatchObject({
      id: 'custom-openai-compatible', provider: 'openai-compatible', offlineCapable: false,
    });
    expect(values.get('devnoder-key-openai-compatible')).toBe('encrypted:secret-token');
    expect(values.get('devnoder-openai-compatible-endpoint')).not.toContain('secret-token');
    expect(aiGateway.getCustomEndpointSettings()).toMatchObject({
      baseUrl: 'https://model.example/v1', model: 'org/code-model', hasApiKey: true,
    });
  });

  it('sends the exact configured model ID to the configured OpenAI-compatible route', async () => {
    await aiGateway.configureCustomEndpoint({
      baseUrl: 'https://model.example/v1', model: 'local/qwen-coder:7b', apiKey: 'secret-token',
    });
    aiGateway.setModel('custom-openai-compatible');
    const chunks: string[] = [];

    await aiGateway.stream([{ role: 'user', content: 'hello' }], chunk => chunks.push(chunk.delta));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://model.example/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-token');
    expect(JSON.parse(String(init.body)).model).toBe('local/qwen-coder:7b');
    expect(chunks.join('')).toContain('hello');
  });

  it('preserves events when SSE JSON and CRLF separators are split across transport chunks', async () => {
    await aiGateway.configureCustomEndpoint({ baseUrl: 'https://model.example/v1', model: 'qwen-coder' });
    aiGateway.setModel('custom-openai-compatible');
    fetchMock.mockResolvedValue(responseWithChunkedSSE());
    let text = '';

    await aiGateway.stream([{ role: 'user', content: 'hello' }], chunk => { text += chunk.delta; });

    expect(text).toBe('hello');
  });

  it('allows a deliberately configured localhost server without a key', async () => {
    await aiGateway.configureCustomEndpoint({
      baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5-coder:7b',
    });
    aiGateway.setModel('custom-openai-compatible');

    await aiGateway.stream([{ role: 'user', content: 'test' }], () => {});

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('reports hosted providers as requiring setup until their key is configured', () => {
    aiGateway.setModel('llama-3.1-8b-instant');
    expect(aiGateway.getModelSetupState()).toMatchObject({ kind: 'hosted', configured: false });

    aiGateway.setKey('groq', 'gsk_test');
    expect(aiGateway.getModelSetupState()).toMatchObject({ kind: 'hosted', configured: true });
  });

  it('treats the pinned local model as configured but still requiring tab preparation', () => {
    aiGateway.setModel(MODELS[0].id);
    expect(aiGateway.getModelSetupState()).toMatchObject({
      kind: 'local', configured: true,
      reason: 'Prepare the model in this tab before sending a prompt.',
    });
  });

  it('adds only a pinned prebuilt local model and restores its exact catalog entry from browser storage', async () => {
    const model = await aiGateway.addPrebuiltLocalModel('org/approved-chat-model');

    expect(model).toMatchObject({
      id: 'org/approved-chat-model',
      provider: 'webllm',
      offlineCapable: true,
      vramRequiredMB: 1536,
      lowResourceRequired: true,
    });
    expect(aiGateway.getModels().some(item => item.id === model.id)).toBe(true);

    await aiGateway.loadKeys();
    expect(aiGateway.getModels().find(item => item.id === model.id)).toMatchObject(model);

    aiGateway.removePrebuiltLocalModel(model.id);
    expect(aiGateway.getModels().some(item => item.id === model.id)).toBe(false);
  });

  it('rejects arbitrary repositories and non-chat entries that are not supported by the pinned runtime', async () => {
    await expect(aiGateway.addPrebuiltLocalModel('some-user/random-gguf')).rejects.toThrow('not in the installed WebLLM prebuilt registry');
    await expect(aiGateway.addPrebuiltLocalModel('org/vision-model')).rejects.toThrow('not in the installed WebLLM prebuilt registry');
  });

  it('registers public Transformers.js model IDs without accepting URLs or path traversal', async () => {
    const model = aiGateway.addTransformersCompatibleModel('Xenova/Qwen2.5-Coder-0.5B-Instruct');
    expect(model).toMatchObject({
      id: 'transformers:Xenova/Qwen2.5-Coder-0.5B-Instruct',
      provider: 'transformers',
      offlineCapable: true,
      transformersModelId: 'Xenova/Qwen2.5-Coder-0.5B-Instruct',
    });

    await aiGateway.loadKeys();
    expect(aiGateway.getModels().find(item => item.id === model.id)).toMatchObject(model);
    aiGateway.removePrebuiltLocalModel(model.id);

    expect(() => aiGateway.addTransformersCompatibleModel('https://huggingface.co/owner/model')).toThrow('owner/model');
    expect(() => aiGateway.addTransformersCompatibleModel('owner/../outside')).toThrow('owner/model');
    expect(() => aiGateway.addTransformersCompatibleModel('owner/model/extra')).toThrow('owner/model');
  });
});
