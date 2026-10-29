import React, { useCallback, useEffect, useState } from 'react';
import { listFiles, normalizeProjectPath, readFile, writeFile } from '../../services/git/GitService';
import { bufferManager } from '../../services/editor/BufferManager';
import { AppIcon } from '../brand/AppIcon';
import './ProjectFiles.css';

export default function ProjectFiles({ onFileOpened }: { onFileOpened?: () => void }) {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPath, setNewPath] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const currentFiles = (await listFiles()).sort((a, b) => a.localeCompare(b));
      setFiles(currentFiles);
      // Resume a useful file without replacing a buffer already chosen by the user.
      if (!bufferManager.getActive() && currentFiles.length) {
        const entry = currentFiles.includes('index.html') ? 'index.html' : currentFiles.find(path => /\.(html|css|js|ts|py|php|md|json|txt)$/.test(path));
        if (entry) bufferManager.open(entry, await readFile(entry));
      }
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Files could not be loaded.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const create = () => { setCreating(true); };
    window.addEventListener('devnoder:new-file', create);
    return () => window.removeEventListener('devnoder:new-file', create);
  }, []);

  const openFile = async (path: string) => {
    try { bufferManager.open(path, await readFile(path)); setError(null); onFileOpened?.(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'File could not be opened.'); }
  };

  const createFile = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const path = normalizeProjectPath(newPath.trim());
      if (files.includes(path)) throw new Error(`A file already exists at ${path}.`);
      await writeFile(path, '');
      bufferManager.open(path, '');
      setNewPath('');
      setCreating(false);
      setError(null);
      await refresh();
      onFileOpened?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'File could not be created.'); }
  };

  return (
    <aside id="code-files-explorer" className="project-files" aria-label="Project files">
      <div className="project-files__header">
        <div><span className="project-files__eyebrow">Explorer</span><h2>Files</h2></div>
        <button type="button" className="project-files__new-button" onClick={() => setCreating(value => !value)} aria-label={creating ? 'Cancel new file' : 'New file'}>
          <AppIcon name={creating ? 'close' : 'plus'} size={17} />
        </button>
      </div>
      {creating && (
        <form className="project-files__new" onSubmit={createFile}>
          <label htmlFor="project-files-new-path">New file path</label>
          <input id="project-files-new-path" value={newPath} onChange={event => setNewPath(event.target.value)} placeholder="src/main.js" autoFocus />
          <button type="submit" disabled={!newPath.trim()}>Create file</button>
        </form>
      )}
      {error && <p className="project-files__error" role="alert">{error}</p>}
      {loading ? <p className="project-files__empty" role="status">Loading files…</p> : (
        <div className="project-files__tree" role="tree" aria-label="Project file tree">
          {files.map(path => (
            <button key={path} type="button" className="project-files__row" role="treeitem" onClick={() => void openFile(path)} aria-label={path}>
              <AppIcon name="file" size={15} />
              <span>{path}</span>
            </button>
          ))}
          {files.length === 0 && <div className="project-files__empty"><p>No files yet.</p><button type="button" onClick={() => setCreating(true)}>Create your first file</button></div>}
        </div>
      )}
    </aside>
  );
}
