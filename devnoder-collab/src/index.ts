/// <reference types="@cloudflare/workers-types" />
// devnoder-collab/src/index.ts — Hocuspocus-style collab DO with D1 persistence and GitHub OAuth
import { DurableObject } from 'cloudflare:workers';
import * as Y from 'yjs';

export class CollabRoom extends DurableObject {
  private sessions: Set<WebSocket> = new Set();
  private docs = new Map<string, Y.Doc>();
  private db: D1Database;

  constructor(ctx: DurableObjectState, env: { DB: D1Database }) {
    super(ctx);
    this.db = env.DB;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const url = new URL(request.url);
    const token = url.searchParams.get('token') || undefined;

    if (token) {
      const valid = await this.validateGitHubToken(token);
      if (!valid) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);

    const roomId = url.pathname.slice(1) || 'default';
    const doc = this.getDoc(roomId);

    server.addEventListener('message', (event: MessageEvent) => {
      try {
        const update = new Uint8Array(event.data as ArrayBuffer);
        Y.applyUpdate(doc, update);
        this.persistDoc(roomId, doc);
        for (const session of this.sessions) {
          if (session !== server && session.readyState === WebSocket.OPEN) {
            session.send(event.data);
          }
        }
      } catch {
        // ignore malformed updates
      }
    });

    server.addEventListener('close', () => {
      this.sessions.delete(server);
      this.persistDoc(roomId, doc);
    });

    server.addEventListener('error', () => {
      this.sessions.delete(server);
    });

    this.sessions.add(server);

    // Send the current document state to the newly connected client
    const state = Y.encodeStateAsUpdate(doc);
    server.send(state);

    return new Response(null, { status: 101, webSocket: client });
  }

  private getDoc(roomId: string): Y.Doc {
    let doc = this.docs.get(roomId);
    if (!doc) {
      doc = new Y.Doc();
      this.docs.set(roomId, doc);
      this.loadDoc(roomId, doc).catch(() => {});
    }
    return doc;
  }

  private async loadDoc(roomId: string, doc: Y.Doc): Promise<void> {
    try {
      const row = await this.db.prepare('SELECT state FROM documents WHERE room_id = ?').bind(roomId).first<{ state: ArrayBuffer }>();
      if (row?.state) {
        const buffer = new Uint8Array(row.state as ArrayBuffer);
        Y.applyUpdate(doc, buffer);
      }
    } catch {
      // table may not exist yet
    }
  }

  private async persistDoc(roomId: string, doc: Y.Doc): Promise<void> {
    const state = Y.encodeStateAsUpdate(doc);
    try {
      await this.db.prepare(`
        INSERT INTO documents (room_id, state, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(room_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at
      `).bind(roomId, state, Date.now()).run();
    } catch {
      // table may not exist yet
    }
  }

  private async validateGitHubToken(token: string): Promise<boolean> {
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
