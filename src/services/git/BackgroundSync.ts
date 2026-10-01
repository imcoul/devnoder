// BackgroundSync.ts — offline-first retry with Workbox Background Sync stub.
//
// The existing SyncQueue already retries on the `online` event. This module
// adds periodic retry and a Background Sync registration stub for when the
// service worker gains access to the auth token (requires migrating the
// GitHub token from localStorage to IndexedDB).
export interface SyncTask {
  id: string;
  run: () => Promise<void>;
  retryAt: number;
  attempts: number;
}

class BackgroundSync {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private maxAttempts = 5;
  private baseDelay = 10_000;

  enqueue(id: string, run: () => Promise<void>): void {
    const existing = this.timers.get(id);
    if (existing) clearTimeout(existing);

    const task: SyncTask = { id, run, retryAt: Date.now() + this.baseDelay, attempts: 0 };
    this.schedule(task);
  }

  private schedule(task: SyncTask): void {
    const delay = Math.min(this.baseDelay * Math.pow(2, task.attempts), 60_000);
    task.retryAt = Date.now() + delay;

    const timer = setTimeout(async () => {
      this.timers.delete(task.id);
      try {
        await task.run();
      } catch {
        task.attempts++;
        if (task.attempts < this.maxAttempts) {
          this.schedule(task);
        }
      }
    }, delay);

    this.timers.set(task.id, timer);
  }

  cancel(id: string): void {
    const timer = this.timers.get(id);
    if (timer) { clearTimeout(timer); this.timers.delete(id); }
  }

  clearAll(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  pending(): string[] {
    return Array.from(this.timers.keys());
  }
}

export const backgroundSync = new BackgroundSync();

// Register a service worker Background Sync tag when supported.
// The actual sync handler lives in the SW and requires the auth token
// to be stored in IndexedDB rather than localStorage.
export async function registerSyncTag(tag: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) (reg as any).sync?.register(tag);
  } catch {
    // Background Sync not supported — fall back to online listener + timer
  }
}
