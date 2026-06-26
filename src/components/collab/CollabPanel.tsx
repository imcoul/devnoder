import React, { useState, useEffect, useCallback } from 'react';
import { collabService, Peer } from '../../services/collab/CollabService';
import './CollabPanel.css';

function PeerAvatar({ peer }: { peer: Peer }) {
  return (
    <div className="peer-avatar" style={{ borderColor: peer.color }} title={peer.name}>
      <span style={{ color: peer.color }}>{peer.name.slice(0, 2).toUpperCase()}</span>
    </div>
  );
}

export default function CollabPanel() {
  const [active, setActive]     = useState(false);
  const [roomId, setRoomId]     = useState('');
  const [joinId, setJoinId]     = useState('');
  const [peers, setPeers]       = useState<Peer[]>([]);
  const [link, setLink]         = useState('');
  const [copied, setCopied]     = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [mode, setMode]         = useState<'create' | 'join'>('create');

  useEffect(() => {
    collabService.onChange(() => {
      setPeers(collabService.getPeers());
    });
    // Auto-join if URL has ?room=
    const params = new URLSearchParams(location.search);
    const room = params.get('room');
    if (room) { setJoinId(room); setMode('join'); }
  }, []);

  const create = useCallback(async () => {
    setConnecting(true); setError(null);
    try {
      const id = CollabService.newRoomId();
      await collabService.join(id);
      setRoomId(id);
      setLink(collabService.roomLink(id));
      setActive(true);
    } catch (e: any) { setError(e.message); }
    finally { setConnecting(false); }
  }, []);

  const join = useCallback(async () => {
    if (!joinId.trim()) return;
    setConnecting(true); setError(null);
    try {
      await collabService.join(joinId.trim());
      setRoomId(joinId.trim());
      setLink(collabService.roomLink(joinId.trim()));
      setActive(true);
    } catch (e: any) { setError(e.message); }
    finally { setConnecting(false); }
  }, [joinId]);

  const leave = useCallback(async () => {
    await collabService.leave();
    setActive(false); setRoomId(''); setLink(''); setPeers([]);
  }, []);

  const copyLink = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (active) {
    return (
      <div className="collab-panel">
        <div className="collab-active-header">
          <div className="collab-status-dot" />
          <span className="collab-room-label">Room: <code>{roomId}</code></span>
          <button className="collab-leave-btn" onClick={leave}>Leave</button>
        </div>

        <div className="collab-peers-section">
          <div className="collab-section-head">
            Connected ({peers.length + 1})
          </div>
          <div className="collab-peers-list">
            {/* Self */}
            <div className="peer-row">
              <div className="peer-avatar peer-avatar--self">
                <span>ME</span>
              </div>
              <span className="peer-name">You</span>
              <span className="peer-badge">host</span>
            </div>
            {peers.map(peer => (
              <div key={peer.clientId} className="peer-row">
                <PeerAvatar peer={peer} />
                <span className="peer-name">{peer.name}</span>
                {peer.cursor && (
                  <span className="peer-cursor">L{peer.cursor.line}</span>
                )}
              </div>
            ))}
            {peers.length === 0 && (
              <p className="collab-waiting">Waiting for others to join…</p>
            )}
          </div>
        </div>

        <div className="collab-invite-section">
          <div className="collab-section-head">Invite Link</div>
          <div className="collab-link-row">
            <input className="collab-link-input" value={link} readOnly />
            <button className="collab-copy-btn" onClick={copyLink}>
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
          <p className="collab-note">
            Share this link. Peers edit the same file in real-time via Yjs CRDT.
            Works offline between tabs via BroadcastChannel.
          </p>
        </div>

        <div className="collab-info-section">
          <div className="collab-section-head">Sync Status</div>
          <div className="collab-info-row">
            <span>IndexedDB</span><span className="collab-ok">✅ Persisted</span>
          </div>
          <div className="collab-info-row">
            <span>WebSocket (DO)</span>
            <span className={peers.length > 0 ? 'collab-ok' : 'collab-warn'}>
              {peers.length > 0 ? '✅ Connected' : '⏳ Waiting'}
            </span>
          </div>
          <div className="collab-info-row">
            <span>BroadcastChannel</span><span className="collab-ok">✅ Active</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="collab-panel">
      <div className="collab-hero">
        <span className="collab-hero-icon">👥</span>
        <h2 className="collab-hero-title">Real-Time Collaboration</h2>
        <p className="collab-hero-sub">
          Pair-program with anyone. Powered by Yjs CRDT + Cloudflare Durable Objects.
          Works offline between tabs via BroadcastChannel.
        </p>
      </div>

      <div className="collab-mode-tabs">
        <button className={`collab-mode-tab ${mode === 'create' ? 'active' : ''}`}
          onClick={() => setMode('create')}>Create Room</button>
        <button className={`collab-mode-tab ${mode === 'join' ? 'active' : ''}`}
          onClick={() => setMode('join')}>Join Room</button>
      </div>

      {mode === 'create' ? (
        <div className="collab-form">
          <p className="collab-form-desc">
            Start a new collaboration session. Share the generated link with your pair.
          </p>
          <button className="collab-primary-btn" onClick={create} disabled={connecting}>
            {connecting ? 'Creating…' : '⚡ Create Room'}
          </button>
        </div>
      ) : (
        <div className="collab-form">
          <p className="collab-form-desc">Enter a room ID or paste a DevNoder collaboration link.</p>
          <input className="collab-input" value={joinId}
            onChange={e => setJoinId(e.target.value)}
            placeholder="srvel-abc123-xyz or paste link"
            onKeyDown={e => e.key === 'Enter' && join()} />
          <button className="collab-primary-btn" onClick={join}
            disabled={connecting || !joinId.trim()}>
            {connecting ? 'Joining…' : '→ Join Room'}
          </button>
        </div>
      )}

      {error && <div className="collab-error">{error}</div>}

      <div className="collab-requirements">
        <div className="collab-section-head">Requirements</div>
        <div className="collab-req-row">
          <span>🟢</span><span>Offline tab sync — always works</span>
        </div>
        <div className="collab-req-row">
          <span>🌐</span><span>Cross-device — deploy <code>devnoder-collab</code> Worker</span>
        </div>
        <div className="collab-req-row">
          <span>📋</span><span>See Manual Tasks in Notion for deploy steps</span>
        </div>
      </div>
    </div>
  );
}

// Re-export for use in this file
const { newRoomId } = collabService.constructor as unknown as typeof import('../../services/collab/CollabService').collabService & { newRoomId: () => string };
