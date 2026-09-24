import { describe, it, expect, vi, beforeEach } from 'vitest';

(global as any).location = { origin: 'http://localhost:5173' };

vi.mock('yjs', () => {
  const listeners = new Map<string, Set<(...args: any[]) => void>>();
  return {
    Doc: class MockDoc {
      getText() {
        return { toString: () => '' };
      }
      on(event: string, cb: (...args: any[]) => void) {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(cb);
        return this;
      }
      emit(event: string, ...args: any[]) {
        const cbs = listeners.get(event);
        if (cbs) cbs.forEach(cb => cb(...args));
      }
      destroy() {}
    },
  };
});

vi.mock('y-indexeddb', () => ({
  IndexeddbPersistence: class MockIndexeddbPersistence {
    constructor() {}
    whenSynced = Promise.resolve();
    destroy() {}
  },
}));

vi.mock('y-websocket', () => ({
  WebsocketProvider: class MockWebsocketProvider {
    awareness = {
      setLocalStateField: vi.fn(),
      on: vi.fn(),
      getStates: () => new Map(),
    };
    destroy() {}
  },
}));

vi.mock('../../components/editor/CodeEditor', () => ({}));

import { collabService } from '../collab/CollabService';

describe('CollabService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with no session', () => {
    expect(collabService.getSession()).toBeNull();
    expect(collabService.isActive()).toBe(false);
    expect(collabService.getSharedText()).toBeNull();
    expect(collabService.getPeers()).toEqual([]);
  });

  it('generates room links', () => {
    const link = collabService.roomLink('test-room');
    expect(link).toContain('room=test-room');
  });

  it('onChange notifies listeners on doc update', async () => {
    const listener = vi.fn();
    collabService.onChange(listener);
    const session = await collabService.join('test-room');
    expect(listener).not.toHaveBeenCalled();
    const doc = session.doc as any;
    doc.emit('update');
    expect(listener).toHaveBeenCalledTimes(1);
    collabService.leave();
  });

  it('join creates session and cleans up on leave', async () => {
    const session = await collabService.join('test-room', 'TestUser');
    expect(session).toBeDefined();
    expect(session.roomId).toBe('test-room');
    expect(session.active).toBe(true);
    collabService.leave();
    expect(collabService.getSession()).toBeNull();
    expect(collabService.isActive()).toBe(false);
  });

  it('leave is safe to call without join', async () => {
    await expect(collabService.leave()).resolves.toBeUndefined();
  });

  it('multiple joins clean up previous session', async () => {
    await collabService.join('room-1');
    await collabService.join('room-2');
    expect(collabService.getSession()?.roomId).toBe('room-2');
    collabService.leave();
  });

  it('getSharedText returns Y.Text', async () => {
    await collabService.join('test-room');
    const text = collabService.getSharedText();
    expect(text).not.toBeNull();
    collabService.leave();
  });
});
