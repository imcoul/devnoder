import React, { useState, useEffect, useCallback } from 'react';
import { collabService, Peer } from '../../services/collab/CollabService';
import './CollabPanel.css';

const CROSS_DEVICE_COLLAB_AVAILABLE = false;

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
      const id = crypto.randomUUID();
      await collabService.join(id);
      setRoomId(id);
      setActive(true);
    } catch (e: any) { setError(e.message); }
    finally { setConnecting(false); }
  }, []);

  const join = useCallback(async () => {
    if (!joinId.trim() || !CROSS_DEVICE_COLLAB_AVAILABLE) {
      setError('Cross-device collaboration is not configured. Start a local same-device session instead.');
      return;
    }
    setConnecting(true); setError(null);
    try {
      await collabService.join(joinId.trim());
      setRoomId(joinId.trim());
      setActive(true);
    } catch (e: any) { setError(e.message); }
    finally { setConnecting(false); }
  }, [joinId]);

  const leave = useCallback(async () => {
    await collabService.leave();
    setActive(false); setRoomId(''); setPeers([]);
  }, []);

  if (active) {
    return (
      <div className="collab-panel">
        <div className="collab-active-header">
          <div className="collab-status-dot" />
          <span className="collab-room-label">Local tab session: <code>{roomId}</code></span>
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
          <div className="collab-section-head">Same-device collaboration</div>
          <p className="collab-note">
            This session is limited to the local browser. No share link is created until the collaboration Worker is configured.
          </p>
        </div>

        <div className="collab-info-section">
          <div className="collab-section-head">Sync Status</div>
          <div className="collab-info-row">
            <span>IndexedDB</span><span className="collab-ok">Persisted locally</span>
          </div>
          <div className="collab-info-row">
            <span>WebSocket (DO)</span>
            <span className="collab-warn">Unavailable — Worker not configured</span>
          </div>
          <div className="collab-info-row"><span>Browser-local storage</span><span className="collab-ok">Active</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="collab-panel">
      <div className="collab-hero">
        <h2 className="collab-hero-title">Real-Time Collaboration</h2>
        <p className="collab-hero-sub">
          Keep a local same-device session for this browser. Cross-device collaboration is not offered until its Worker is configured.
        </p>
      </div>

      <div className="collab-mode-tabs">
        <button className={`collab-mode-tab ${mode === 'create' ? 'active' : ''}`}
          onClick={() => setMode('create')}>Create Room</button>
        <button className={`collab-mode-tab ${mode === 'join' ? 'active' : ''}`}
          onClick={() => setMode('join')} disabled={!CROSS_DEVICE_COLLAB_AVAILABLE}>Join Room</button>
      </div>

      {mode === 'create' ? (
        <div className="collab-form">
          <p className="collab-form-desc">
            Start a local same-device collaboration session. No public or cross-device link is created.
          </p>
          <button className="collab-primary-btn" onClick={create} disabled={connecting}>
            {connecting ? 'Creating…' : 'Start local session'}
          </button>
        </div>
      ) : (
        <div className="collab-form">
          <p className="collab-form-desc">Cross-device room joining is unavailable until the collaboration Worker is configured.</p>
          <input className="collab-input" value={joinId}
            onChange={e => setJoinId(e.target.value)}
            placeholder="srvel-abc123-xyz or paste link"
            onKeyDown={e => e.key === 'Enter' && join()} />
          <button className="collab-primary-btn" onClick={join}
            disabled={!CROSS_DEVICE_COLLAB_AVAILABLE || connecting || !joinId.trim()}>
            Join room
          </button>
        </div>
      )}

      {error && <div className="collab-error">{error}</div>}

      <div className="collab-requirements">
        <div className="collab-section-head">Requirements</div>
        <div className="collab-req-row">
          <span>Local</span><span>Browser-local session — available here</span>
        </div>
        <div className="collab-req-row">
          <span>Remote</span><span>Cross-device — unavailable until <code>devnoder-collab</code> is configured</span>
        </div>
        <div className="collab-req-row">
          <span>Note</span><span>No share link is shown while remote collaboration is unavailable</span>
        </div>
      </div>
    </div>
  );
}
