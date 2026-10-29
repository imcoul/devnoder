import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pipeline: vi.fn(),
  hasModelInCache: vi.fn(async () => false),
  deleteModelInCache: vi.fn(async () => {}),
  createMLCEngine: vi.fn(),
}));
vi.mock('@huggingface/transformers', () => ({ pipeline: mocks.pipeline }));
vi.mock('@mlc-ai/web-llm', () => ({
  CreateMLCEngine: mocks.createMLCEngine,
  hasModelInCache: mocks.hasModelInCache,
  deleteModelInCache: mocks.deleteModelInCache,
  prebuiltAppConfig: { model_list: [
    { model_id: 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC', model_type: 0 },
    { model_id: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC', model_type: 0 },
    { model_id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', model_type: 0 },
  ] },
}));

import { webLLMManager } from './WebLLMManager';

describe('WebLLMManager selected-model fidelity', () => {
  beforeEach(async () => {
    await webLLMManager.unload();
    mocks.pipeline.mockReset();
    mocks.hasModelInCache.mockReset();
    mocks.hasModelInCache.mockResolvedValue(false);
    mocks.deleteModelInCache.mockReset();
    mocks.pipeline.mockResolvedValue(async () => [{ generated_text: 'assistant: ok' }]);
  });

  it('uses the selected Qwen model’s declared Transformers.js repository on a non-WebGPU device', async () => {
    await webLLMManager.load('Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC');

    expect(mocks.pipeline).toHaveBeenCalledWith(
      'text-generation',
      'onnx-community/Qwen2.5-Coder-0.5B-Instruct',
      expect.objectContaining({ dtype: 'q8', progress_callback: expect.any(Function) }),
    );
  });

  it('sends chat messages and reads the final assistant message from chat-shaped output', async () => {
    const generated = vi.fn(async (chat: Array<{ role: string; content: string }>, options: Record<string, unknown>) => {
      expect(chat).toEqual([{ role: 'user', content: 'Write a function.' }]);
      expect(options).toMatchObject({ max_new_tokens: 512, do_sample: false });
      return [{ generated_text: [...chat, { role: 'assistant', content: 'function answer() {}' }] }];
    });
    mocks.pipeline.mockResolvedValue(generated);
    await webLLMManager.stream('Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC', [
      { role: 'user', content: 'Write a function.' },
    ], () => {});

    expect(generated).toHaveBeenCalledTimes(1);
  });

  it('does not silently run a different model when no matching WASM fallback exists', async () => {
    await expect(webLLMManager.load('Phi-3.5-mini-instruct-q4f16_1-MLC'))
      .rejects.toThrow('requires a compatible WebGPU device');
    expect(mocks.pipeline).not.toHaveBeenCalled();
  });

  it('reports model-file download progress and provides an unsubscribe function', async () => {
    const updates: Array<{ progress: number; label: string; modelId: string }> = [];
    const unsubscribe = webLLMManager.onProgress((progress, label, modelId) => updates.push({ progress, label, modelId }));

    await webLLMManager.load('Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC');
    const options = mocks.pipeline.mock.calls[0][2] as { progress_callback: (info: unknown) => void };
    options.progress_callback({ status: 'progress', progress: 50, file: 'model.onnx' });

    expect(updates.some(update => update.progress === 48 && update.label.includes('model.onnx'))).toBe(true);
    expect(updates.at(-1)?.modelId).toBe('Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC');
    unsubscribe();
  });

  it('deduplicates concurrent preparation requests for the same local model', async () => {
    let finish: ((value: (prompt: string) => Promise<unknown[]>) => void) | undefined;
    mocks.pipeline.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const modelId = 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC';
    const first = webLLMManager.load(modelId);
    const second = webLLMManager.load(modelId);

    await vi.waitFor(() => expect(mocks.pipeline).toHaveBeenCalledTimes(1));
    finish?.(async () => [{ generated_text: 'assistant: ok' }]);
    await Promise.all([first, second]);
    expect(webLLMManager.isLoadedFor(modelId)).toBe(true);
    expect(webLLMManager.getPreparationState(modelId)).toBe('ready-in-tab');
  });

  it('starts not prepared and reports downloading while preparation is pending', async () => {
    let finish: ((value: (prompt: string) => Promise<unknown[]>) => void) | undefined;
    mocks.pipeline.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const modelId = 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC';

    expect(webLLMManager.getPreparationState(modelId)).toBe('not-prepared');
    const pending = webLLMManager.load(modelId);
    await vi.waitFor(() => expect(webLLMManager.getPreparationState(modelId)).toBe('downloading'));
    await vi.waitFor(() => expect(mocks.pipeline).toHaveBeenCalledTimes(1));
    expect(finish).toBeTypeOf('function');
    finish!(async () => [{ generated_text: 'assistant: ok' }]);
    await pending;
    expect(webLLMManager.getPreparationState(modelId)).toBe('ready-in-tab');
  });

  it('reports WebLLM cache state and deletes only the requested model cache', async () => {
    mocks.hasModelInCache.mockResolvedValue(true);
    const modelId = 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC';

    await expect(webLLMManager.hasCachedModelFiles(modelId)).resolves.toBe(true);
    await webLLMManager.deleteCachedModelFiles(modelId);

    expect(mocks.hasModelInCache).toHaveBeenCalledWith(modelId);
    expect(mocks.deleteModelInCache).toHaveBeenCalledWith(modelId);
  });
});
