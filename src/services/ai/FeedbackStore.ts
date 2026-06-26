// FeedbackStore.ts — local-only rated conversation storage, zero telemetry
import Dexie, { Table } from 'dexie';
import type { AgentId } from './AIAgents';
import type { Message } from './AIGateway';

export type Rating = 'good' | 'bad' | 'edited';

export interface FeedbackEntry {
  id?: number;
  timestamp: number;
  agentId: AgentId;
  modelId: string;
  messages: Message[];        // full conversation context
  response: string;           // what the model said
  rating: Rating;
  editedResponse?: string;    // filled when user corrects the response
  language: string;           // active file language at request time
  projectHash: string;        // one-way SHA-256 hash of project name ONLY — no content
  exported: boolean;
  // Explicitly excluded: file contents, repo URLs, API keys,
  // device identifiers, IP addresses, personal data of any kind.
}

class FeedbackDB extends Dexie {
  entries!: Table<FeedbackEntry>;
  constructor() {
    super('devnoder-feedback');
    this.version(1).stores({
      entries: '++id, timestamp, agentId, modelId, rating, exported',
    });
  }
}

const db = new FeedbackDB();

async function hashProject(projectName: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(projectName));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

export const feedbackStore = {
  async add(entry: Omit<FeedbackEntry, 'id' | 'exported' | 'projectHash'> & { projectName?: string }): Promise<number> {
    const { projectName, ...rest } = entry;
    const projectHash = await hashProject(projectName ?? 'unknown');
    return db.entries.add({ ...rest, projectHash, exported: false }) as Promise<number>;
  },

  async rate(id: number, rating: Rating, editedResponse?: string): Promise<void> {
    await db.entries.update(id, { rating, ...(editedResponse !== undefined && { editedResponse }) });
  },

  async getAll(): Promise<FeedbackEntry[]> {
    return db.entries.orderBy('timestamp').reverse().toArray();
  },

  async getByRating(rating: Rating): Promise<FeedbackEntry[]> {
    return db.entries.where('rating').equals(rating).reverse().sortBy('timestamp');
  },

  async getUnexported(): Promise<FeedbackEntry[]> {
    return db.entries.where('exported').equals(0).toArray();
  },

  async markExported(ids: number[]): Promise<void> {
    await db.entries.where('id').anyOf(ids).modify({ exported: true });
  },

  async delete(id: number): Promise<void> {
    await db.entries.delete(id);
  },

  async deleteAll(): Promise<void> {
    await db.entries.clear();
  },

  async stats(): Promise<{ total: number; good: number; bad: number; edited: number; unexported: number }> {
    const [total, good, bad, edited, unexported] = await Promise.all([
      db.entries.count(),
      db.entries.where('rating').equals('good').count(),
      db.entries.where('rating').equals('bad').count(),
      db.entries.where('rating').equals('edited').count(),
      db.entries.where('exported').equals(0).count(),
    ]);
    return { total, good, bad, edited, unexported };
  },
};
