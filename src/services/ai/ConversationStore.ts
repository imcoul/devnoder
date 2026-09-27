// ConversationStore.ts — persistent chat history, Dexie-backed, append-only per thread.
import Dexie, { Table } from 'dexie';
import type { Message } from './AIGateway';

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  modelId?: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationMessage extends Message {
  id?: number;
  conversationId: string;
  timestamp: number;
}

class ConversationDB extends Dexie {
  conversations!: Table<Conversation>;
  messages!: Table<ConversationMessage>;
  constructor() {
    super('devnoder-conversations');
    this.version(1).stores({
      conversations: '&id, updatedAt, modelId',
      messages: '++id, conversationId, role, timestamp',
    });
  }
}

const db = new ConversationDB();

export const conversationStore = {
  async create(title = 'New conversation', opts: { modelId?: string; agentId?: string; metadata?: Record<string, unknown> } = {}): Promise<string> {
    const id = crypto.randomUUID();
    const now = Date.now();
    await db.conversations.add({
      id, title, createdAt: now, updatedAt: now,
      modelId: opts.modelId, agentId: opts.agentId, metadata: opts.metadata,
    });
    return id;
  },

  async get(id: string): Promise<Conversation | undefined> {
    return db.conversations.get(id);
  },

  async list(): Promise<Conversation[]> {
    return db.conversations.orderBy('updatedAt').reverse().toArray();
  },

  async update(id: string, patch: Partial<Pick<Conversation, 'title' | 'modelId' | 'agentId' | 'metadata'>>): Promise<void> {
    await db.conversations.update(id, { ...patch, updatedAt: Date.now() });
  },

  async delete(id: string): Promise<void> {
    await db.messages.where('conversationId').equals(id).delete();
    await db.conversations.delete(id);
  },

  async addMessage(conversationId: string, message: Omit<ConversationMessage, 'id' | 'conversationId' | 'timestamp'>): Promise<number> {
    const msg: ConversationMessage = {
      ...message,
      conversationId,
      timestamp: Date.now(),
    };
    await db.messages.add(msg);
    await db.conversations.update(conversationId, { updatedAt: Date.now() });
    return msg.id ?? 0;
  },

  async getMessages(conversationId: string, limit = 200): Promise<ConversationMessage[]> {
    const all = await db.messages.where('conversationId').equals(conversationId).sortBy('timestamp');
    const start = Math.max(0, all.length - limit);
    return all.slice(start);
  },

  async clearMessages(conversationId: string): Promise<void> {
    await db.messages.where('conversationId').equals(conversationId).delete();
  },

  async clearAll(): Promise<void> {
    await db.messages.clear();
    await db.conversations.clear();
  },

  async stats(): Promise<{ conversations: number; messages: number }> {
    const [conversations, messages] = await Promise.all([
      db.conversations.count(),
      db.messages.count(),
    ]);
    return { conversations, messages };
  },
};
