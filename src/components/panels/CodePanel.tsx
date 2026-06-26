import React from 'react';
import CodeEditor from '../editor/CodeEditor';
import ModeSwitcher from '../editor/ModeSwitcher';
import './CodePanel.css';

export default function CodePanel() {
  return (
    <div className="code-panel">
      <div className="code-panel-toolbar">
        <ModeSwitcher />
      </div>
      <div className="code-panel-editor">
        <CodeEditor />
      </div>
    </div>
  );
}
