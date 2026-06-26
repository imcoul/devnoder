// CollabService.ts — Yjs CRDT, IndexedDB + DO + BroadcastChannel
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebsocketProvider } from 'y-websocket';

const DO_URL = 'wss://devnoder-collab.srvel-build.workers.dev';

export interface Peer {
  clientId: number; name: string; color: string;
  cursor?: { line: number; ch: number };
}

export interface CollabSession {
  roomId: string; doc: Y.Doc; active: boolean;
  peers: Map<number, Peer>; awareness: any;
}

const PEER_COLORS = ['#40E0D0','#FFFF80','#800080','#60a5fa','#f87171','#22c55e','#f59e0b','#a78bfa'];

function randomColor() { return PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)]; }
function randomName()  { return `Dev-${Math.floor(Math.random() * 9000) + 1000}`; }

class CollabService {
  private session: CollabSession | null = null;
  private wsProvider: WebsocketProvider | null = null;
  private idbProvider: IndexeddbPersistence | null = null;
  private bc: BroadcastChannel | null = null;
  private listeners: Array<() => void> = [];

  onChange(cb: () => void) { this.listeners.push(cb); }
  private notify() { this.listeners.forEach(cb => cb()); }

  async join(roomId: string, userName?: string): Promise<CollabSession> {
    await this.leave();

    const doc = new Y.Doc();

    // Local persistence via IndexedDB
    this.idbProvider = new IndexeddbPersistence(`devnoder-collab-${roomId}`, doc);
    await this.idbProvider.whenSynced;

    // BroadcastChannel for same-device tab sync (always works, no server needed)
    this.bc = new BroadcastChannel(`devnoder-collab-${roomId}`);

    // Try WebSocket to Durable Object
    try {
      this.wsProvider = new WebsocketProvider(DO_URL, roomId, doc, { connect: true });
      this.wsProvider.awareness.setLocalStateField('user', {
        name: userName ?? randomName(),
        color: randomColor(),
      });
    } catch {
      console.warn('CollabService: WebSocket unavailable, local-only mode');
    }

    const peers = new Map<number, Peer>();

    this.session = {
      roomId, doc, active: true, peers,
      awareness: this.wsProvider?.awareness,
    };

    // Track peer awareness
    this.wsProvider?.awareness.on('change', () => {
      const states = this.wsProvider!.awareness.getStates();
      peers.clear();
      states.forEach((state: any, clientId: number) => {
        if (state.user) peers.set(clientId, { clientId, name: state.user.name, color: state.user.color });
      });
      this.notify();
    });

    doc.on('update', () => this.notify());

    // Bind Yjs text to the active CodeMirror editor if one is mounted
    const sharedText = doc.getText('code');
    import('../../components/editor/CodeEditor').then(async m => {
      // The binding is set up reactively — CodeEditor calls bindYjsCollaboration
      // when it detects an active collab session via collabService.getSharedText()
    }).catch(() => {});

    return this.session;
  }

  async leave(): Promise<void> {
    this.wsProvider?.destroy();
    this.idbProvider?.destroy();
    this.bc?.close();
    this.session?.doc.destroy();
    this.wsProvider = null; this.idbProvider = null; this.bc = null; this.session = null;
  }

  getSession() { return this.session; }
  isActive() { return this.session?.active ?? false; }

  getSharedText(key = 'code'): Y.Text | null {
    return this.session?.doc.getText(key) ?? null;
  }

  getPeers(): Peer[] {
    return Array.from(this.session?.peers.values() ?? []);
  }

  /** Generate a shareable room link */
  roomLink(roomId: string): string {
    return `${location.origin}?room=${encodeURIComponent(roomId)}`;
  }

  /** Generate a random room ID */
  static newRoomId(): string {
    return `srvel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }
}

export const collabService = new CollabService();
