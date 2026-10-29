import React, { useCallback, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $projectContext } from '../../stores/projectContext';
import { setPanel } from '../../stores/ui';
import { createProjectArchive } from '../../services/project/ProjectArchive';
import { AppIcon } from '../brand/AppIcon';
import { BrandLockup } from '../brand/BrandLockup';
import './WorkspaceHeader.css';

export default function WorkspaceHeader() {
  const context = useStore($projectContext);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  const downloadBackup = useCallback(async () => {
    if (backupBusy || !context?.project) return;
    setBackupBusy(true);
    setBackupMessage(null);
    let url: string | null = null;
    try {
      const archive = await createProjectArchive();
      url = URL.createObjectURL(archive.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = archive.filename;
      link.click();
      setBackupMessage('Backup downloaded');
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : 'Backup unavailable');
    } finally {
      if (url) window.setTimeout(() => URL.revokeObjectURL(url!), 1000);
      setBackupBusy(false);
    }
  }, [backupBusy, context?.project]);

  return (
    <header className="workspace-header">
      <div className="workspace-header__brand"><BrandLockup compact /></div>
      <div className="workspace-header__project" aria-live="polite">
        <span className="workspace-header__project-label">Workspace</span>
        <strong>{context?.project?.name ?? 'No project open'}</strong>
      </div>
      <div className="workspace-header__actions">
        <span className="workspace-header__local-status" title="Projects are stored in this browser">
          <span className="workspace-header__status-dot" aria-hidden="true" />
          Browser local
        </span>
        {context?.project && (
          <button type="button" className="workspace-header__backup" onClick={() => void downloadBackup()} disabled={backupBusy}>
            <AppIcon name="download" size={16} />
            <span>{backupBusy ? 'Preparing…' : 'Backup'}</span>
          </button>
        )}
        <button type="button" className="workspace-header__projects" onClick={() => setPanel('onboarding')}>
          <AppIcon name="projects" size={17} />
          <span>Projects</span>
        </button>
      </div>
      {backupMessage && <span className="workspace-header__message" role="status">{backupMessage}</span>}
    </header>
  );
}
