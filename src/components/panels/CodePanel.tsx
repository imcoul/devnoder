import React, { useEffect, useState } from 'react';
import CodeEditor from '../editor/CodeEditor';
import ProjectFiles from '../editor/ProjectFiles';
import { AppIcon } from '../brand/AppIcon';
import './CodePanel.css';

export default function CodePanel() {
  const [filesOpen, setFilesOpen] = useState(false);
  useEffect(() => {
    const open = () => setFilesOpen(true);
    window.addEventListener('devnoder:new-file', open);
    return () => window.removeEventListener('devnoder:new-file', open);
  }, []);
  return (
    <div className={`code-panel ${filesOpen ? 'code-panel--files-open' : ''}`}>
      <div className="code-panel-toolbar">
        <span className="code-panel-title">Code</span>
        <span className="code-panel-hint">Edits save to this browser</span>
        <button className="code-files-toggle" type="button" aria-expanded={filesOpen} aria-controls="code-files-explorer" onClick={() => setFilesOpen(value => !value)}>
          <AppIcon name="projects" size={18} />{filesOpen ? 'Close files' : 'Files'}
        </button>
      </div>
      <div className="code-panel-workspace">
        <ProjectFiles onFileOpened={() => setFilesOpen(false)} />
        <div className="code-panel-editor"><CodeEditor /></div>
      </div>
    </div>
  );
}
