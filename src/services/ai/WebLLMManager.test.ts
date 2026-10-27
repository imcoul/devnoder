import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ pipeline: vi.fn() }));
vi.mock('@huggingface/transformers', () => ({ pipeline: mocks.pipeline }));

import { webLLMManager } from './WebLLMManager';

describe('WebLLMManager selected-model fidelity', () => {
  beforeEach(() => {
    webLLMManager.unload();
    mocks.pipeline.mockReset();
    mocks.pipeline.mockResolvedValue(async () => [{ generated_text: 'assistant: ok' }]);
  });

  it('uses the selected Qwen model’s declared Transformers.js repository on a non-WebGPU device', async () => {
    await webLLMManager.load('Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC');

    expect(mocks.pipeline).toHaveBeenCalledWith(
      'text-generation',
      'Xenova/Qwen2.5-Coder-0.5B-Instruct',
      expect.objectContaining({ progress_callback: expect.any(Function) }),
    );
  });

  it('does not silently run a different model when no matching WASM fallback exists', async () => {
    await expect(webLLMManager.load('Phi-3.5-mini-instruct-q4f16_1-MLC'))
      .rejects.toThrow('requires a compatible WebGPU device');
    expect(mocks.pipeline).not.toHaveBeenCalled();
  });
});
