import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const vault = vi.hoisted(() => ({
  encrypt: vi.fn(async (value: string) => `encrypted:${value}`),
  decrypt: vi.fn(async (value: string) => value.startsWith('encrypted:') ? value.slice('encrypted:'.length) : null),
}));

vi.mock('../security/CryptoVault', () => ({ cryptoVault: vault }));

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

  beforeEach(() => {
    values.clear();
    vault.encrypt.mockClear();
    vault.decrypt.mockClear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(responseWithSSE());
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('fetch', fetchMock);
    aiGateway.removeCustomEndpoint();
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
});
