import { describe, it, expect, afterEach } from 'vitest';
import { conversationStore } from './ConversationStore';

describe('conversationStore', () => {
  const ids: string[] = [];

  afterEach(async () => {
    for (const id of ids.splice(0)) {
      try { await conversationStore.delete(id); } catch {}
    }
  });

  it('creates a conversation with defaults and returns its id', async () => {
    const id = await conversationStore.create();
    ids.push(id);
    const c = await conversationStore.get(id);
    expect(c).toBeDefined();
    expect(c!.title).toBe('New conversation');
    expect(c!.modelId).toBeUndefined();
  });

  it('create accepts title, modelId and agentId', async () => {
    const id = await conversationStore.create('Demo', { modelId: 'gpt-4o', agentId: 'coder' });
    ids.push(id);
    const c = (await conversationStore.get(id))!;
    expect(c.title).toBe('Demo');
    expect(c.modelId).toBe('gpt-4o');
    expect(c.agentId).toBe('coder');
  });

  it('get returns undefined for a missing id', async () => {
    expect(await conversationStore.get(crypto.randomUUID())).toBeUndefined();
  });

  it('list returns conversations newest-first by updatedAt', async () => {
    const a = await conversationStore.create('A');
    await new Promise(r => setTimeout(r, 2));
    const b = await conversationStore.create('B');
    ids.push(a, b);
    const list = await conversationStore.list();
    expect(list[0].id).toBe(b);
    expect(list[1].id).toBe(a);
  });

  it('update changes title and refreshes updatedAt', async () => {
    const id = await conversationStore.create('Old');
    ids.push(id);
    const before = (await conversationStore.get(id))!;
    await new Promise(r => setTimeout(r, 2));
    await conversationStore.update(id, { title: 'New' });
    const after = (await conversationStore.get(id))!;
    expect(after.title).toBe('New');
    expect(after.updatedAt).toBeGreaterThanOrEqual(before.updatedAt);
  });

  it('update ignores fields that are not passed', async () => {
    const id = await conversationStore.create('Keep', { modelId: 'gpt-4o-mini' });
    ids.push(id);
    await conversationStore.update(id, { title: 'Renamed' });
    const c = (await conversationStore.get(id))!;
    expect(c.modelId).toBe('gpt-4o-mini');
  });

  it('delete removes the conversation and cascades to messages', async () => {
    const id = await conversationStore.create('Doomed');
    ids.push(id);
    await conversationStore.addMessage(id, { role: 'user', content: 'hi' });
    await conversationStore.delete(id);
    expect(await conversationStore.get(id)).toBeUndefined();
    expect(await conversationStore.getMessages(id)).toHaveLength(0);
  });

  it('addMessage stores messages and getMessages returns them in chronological order', async () => {
    const id = await conversationStore.create('Thread');
    ids.push(id);
    await conversationStore.addMessage(id, { role: 'user', content: 'first' });
    await conversationStore.addMessage(id, { role: 'assistant', content: 'second' });
    const msgs = await conversationStore.getMessages(id);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].content).toBe('first');
    expect(msgs[1].content).toBe('second');
  });

  it('getMessages respects the limit argument', async () => {
    const id = await conversationStore.create('Limit');
    ids.push(id);
    for (let i = 0; i < 5; i++) await conversationStore.addMessage(id, { role: 'user', content: String(i) });
    const msgs = await conversationStore.getMessages(id, 2);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].content).toBe('3');
    expect(msgs[1].content).toBe('4');
  });

  it('clearMessages empties the thread without removing the conversation', async () => {
    const id = await conversationStore.create('Survive');
    ids.push(id);
    await conversationStore.addMessage(id, { role: 'user', content: 'bye' });
    await conversationStore.clearMessages(id);
    expect(await conversationStore.getMessages(id)).toHaveLength(0);
    expect(await conversationStore.get(id)).toBeDefined();
  });

  it('stats returns current conversation and message counts', async () => {
    const a = await conversationStore.create('A');
    const b = await conversationStore.create('B');
    ids.push(a, b);
    await conversationStore.addMessage(a, { role: 'user', content: '1' });
    await conversationStore.addMessage(b, { role: 'user', content: '2' });
    const s = await conversationStore.stats();
    expect(s.conversations).toBeGreaterThanOrEqual(2);
    expect(s.messages).toBeGreaterThanOrEqual(2);
  });

  it('clearAll removes every record', async () => {
    await conversationStore.create('A');
    await conversationStore.create('B');
    await conversationStore.clearAll();
    expect(await conversationStore.list()).toHaveLength(0);
    expect(await conversationStore.stats()).toEqual({ conversations: 0, messages: 0 });
  });
});
