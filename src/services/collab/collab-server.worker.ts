/// <reference types="@cloudflare/workers-types" />
// collab-server.worker.ts — Cloudflare Durable Object WebSocket relay
// Deploy separately: wrangler deploy --config wrangler-collab.toml
import { DurableObject } from 'cloudflare:workers';

export class CollabRoom extends DurableObject {
  private sessions: Set<WebSocket> = new Set();

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);
    this.sessions.add(server);
    server.addEventListener('message', (event: MessageEvent) => {
      for (const session of this.sessions) {
        if (session !== server && session.readyState === WebSocket.OPEN) {
          session.send(event.data);
        }
      }
    });
    server.addEventListener('close', () => { this.sessions.delete(server); });
    server.addEventListener('error', () => { this.sessions.delete(server); });
    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(request: Request, env: { COLLAB_ROOM: DurableObjectNamespace }): Promise<Response> {
    const url = new URL(request.url);
    const roomId = url.pathname.slice(1) || 'default';
    const id = env.COLLAB_ROOM.idFromName(roomId);
    const stub = env.COLLAB_ROOM.get(id);
    return stub.fetch(request);
  },
};
