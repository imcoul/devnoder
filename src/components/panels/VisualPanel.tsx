import React, { useState } from 'react';
import GrapesEditor from '../visual/GrapesEditor';
import FlutterEditor from '../visual/FlutterEditor';
import './VisualPanel.css';

type Mode = 'web' | 'flutter';

export default function VisualPanel() {
  const [mode, setMode] = useState<Mode>('web');
  return (
    <div className="visual-panel">
      <div className="visual-panel-toolbar">
        {(['web', 'flutter'] as const).map(m => (
          <button key={m} className={`visual-mode-btn ${mode === m ? 'active' : ''}`}
            onClick={() => setMode(m)}>
            {m === 'web' ? '🌐 Web' : '🐦 Flutter'}
          </button>
        ))}
      </div>
      <div className="visual-panel-body">
        {mode === 'web' ? <GrapesEditor /> : <FlutterEditor />}
      </div>
    </div>
  );
}
