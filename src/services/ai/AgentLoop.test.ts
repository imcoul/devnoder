import { describe, it, expect, afterEach, vi } from 'vitest';
import { agentLoop } from './AgentLoop';
import { aiGateway } from './AIGateway';

vi.mock('./AIGateway', () => ({
  aiGateway: {
    stream: vi.fn(),
  },
}));

describe('agentLoop', () => {
  afterEach(async () => {
    vi.clearAllMocks();
    const id = agentLoop.getCurrentConversationId();
    if (id) {
      try { await import('./ConversationStore').then(m => m.conversationStore.delete(id)); } catch {}
    }
  });

  it('creates a conversation when no id is provided and persists both messages', async () => {
    const mockStream = aiGateway.stream as ReturnType<typeof vi.fn>;
    mockStream.mockImplementation((_messages: unknown, onChunk: (c: { delta: string; done: boolean }) => void) => {
      onChunk({ delta: 'reply', done: true });
    });

    const result = await agentLoop.run('hi');
    expect(result.conversationId).toBeDefined();
    expect(result.response).toBe('reply');

    const { conversationStore } = await import('./ConversationStore');
    const msgs = await conversationStore.getMessages(result.conversationId);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatchObject({ role: 'user', content: 'hi' });
    expect(msgs[1]).toMatchObject({ role: 'assistant', content: 'reply' });
  });

  it('reuses an existing conversation id', async () => {
    const mockStream = aiGateway.stream as ReturnType<typeof vi.fn>;
    mockStream.mockImplementation((_messages: unknown, onChunk: (c: { delta: string; done: boolean }) => void) => {
      onChunk({ delta: 'reply', done: true });
    });

    const { conversationStore } = await import('./ConversationStore');
    const existingId = await conversationStore.create('Reuse');

    const result = await agentLoop.run('follow-up', { conversationId: existingId });
    expect(result.conversationId).toBe(existingId);

    const msgs = await conversationStore.getMessages(existingId);
    expect(msgs.filter(m => m.role === 'user')).toHaveLength(1);
  });

  it('passes an AbortSignal to the gateway', async () => {
    let captured: AbortSignal | undefined;
    const mockStream = aiGateway.stream as ReturnType<typeof vi.fn>;
    mockStream.mockImplementation((_messages: unknown, _onChunk: any, signal?: AbortSignal) => {
      captured = signal;
      return Promise.resolve();
    });

    await agentLoop.run('hi');
    expect(captured).toBeDefined();
    expect(captured!.aborted).toBe(false);
  });

  it('surfaces toolCall events emitted by the stream', async () => {
    const toolCall = { id: 'tc1', name: 'readFile', args: { path: 'src/a.ts' }, serverId: 'fs' };
    const mockStream = aiGateway.stream as ReturnType<typeof vi.fn>;
    mockStream.mockImplementation((_messages: unknown, onChunk: (c: { delta: string; done: boolean; toolCall?: typeof toolCall }) => void) => {
      onChunk({ delta: '', done: false, toolCall });
      onChunk({ delta: 'done', done: true });
    });

    const result = await agentLoop.run('read a');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]).toMatchObject({ name: 'readFile', serverId: 'fs' });
  });
});
