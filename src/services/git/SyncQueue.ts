// SyncQueue.ts — offline push queue with IndexedDB persistence
import Dexie, { Table } from 'dexie';

export interface QueuedPush {
  id?: number;
  remote: string;
  branch: string;
  commitOid: string;
  queuedAt: number;
  attempts: number;
  lastError?: string;
  status: 'pending' | 'pushing' | 'done' | 'failed';
}

class SyncDB extends Dexie {
  pushQueue!: Table<QueuedPush>;
  constructor() {
    super('devnoder-sync');
    this.version(1).stores({ pushQueue: '++id, status, queuedAt' });
  }
}

const db = new SyncDB();

type SyncHandler = (queue: QueuedPush[]) => void;
const listeners: SyncHandler[] = [];
const notify = async () => {
  const q = await db.pushQueue.orderBy('queuedAt').toArray();
  listeners.forEach(h => h(q));
};

export const syncQueue = {
  onUpdate(h: SyncHandler) { listeners.push(h); },

  async enqueue(remote: string, branch: string, commitOid: string): Promise<void> {
    await db.pushQueue.add({ remote, branch, commitOid, queuedAt: Date.now(), attempts: 0, status: 'pending' });
    await notify();
  },

  async getAll(): Promise<QueuedPush[]> {
    return db.pushQueue.orderBy('queuedAt').toArray();
  },

  async getPending(): Promise<QueuedPush[]> {
    return db.pushQueue.where('status').equals('pending').toArray();
  },

  async markDone(id: number): Promise<void> {
    await db.pushQueue.update(id, { status: 'done' });
    await notify();
  },

  async markFailed(id: number, error: string): Promise<void> {
    const item = await db.pushQueue.get(id);
    if (!item) return;
    const attempts = (item.attempts ?? 0) + 1;
    await db.pushQueue.update(id, {
      status: attempts >= 3 ? 'failed' : 'pending',
      attempts, lastError: error,
    });
    await notify();
  },

  async clear(): Promise<void> {
    await db.pushQueue.where('status').anyOf(['done', 'failed']).delete();
    await notify();
  },

  async flush(pushFn: (item: QueuedPush) => Promise<void>): Promise<void> {
    if (!navigator.onLine) return;
    const pending = await this.getPending();
    for (const item of pending) {
      if (!item.id) continue;
      await db.pushQueue.update(item.id, { status: 'pushing' });
      try {
        await pushFn(item);
        await this.markDone(item.id);
      } catch (e: any) {
        await this.markFailed(item.id, e.message);
      }
    }
  },
};

// Auto-flush when coming online
window.addEventListener('online', () => {
  syncQueue.flush(async (item) => {
    const { push } = await import('./GitService');
    const token = localStorage.getItem('devnoder-gh-token') ?? undefined;
    await push(item.remote, item.branch, token);
  });
});
