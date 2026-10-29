// ProjectService.ts — project lifecycle on top of db.projects + GitService's
// per-project directory scoping. This is the thing that was missing entirely:
// db.projects was defined but never read or written anywhere before this file.
import { db, ProjectRecord, getSetting, setSetting } from '../storage/db';
import {
  fs, initRepo, clone, setActiveProject,
} from '../git/GitService';
import { gitHubAPI } from '../git/GitHubAPI';
import { templateService } from '../templates/TemplateService';
import { bufferManager } from '../editor/BufferManager';
import { setProjectContext, createProjectContext } from '../../stores/projectContext';

export interface CreateProjectOptions {
  templateId?: string;
}

const LAST_ACTIVE_KEY = 'last-active-project-id';

async function makeProjectRecord(name: string, gitRemote?: string): Promise<ProjectRecord> {
  const now = Date.now();
  const record: ProjectRecord = {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    gitRemote,
  };
  await db.projects.put(record);
  return record;
}

export const projectService = {
  async listProjects(): Promise<ProjectRecord[]> {
    return db.projects.orderBy('updatedAt').reverse().toArray();
  },

  /** Call once at app startup. GitService's active-project pointer is an
   * in-memory value that resets on every reload — without this, every
   * reload would silently land in a nonexistent "default" directory
   * instead of the project the user was actually last in. Returns the
   * resumed project, or null if there is nothing to resume (first run). */
  async resumeLastProject(): Promise<ProjectRecord | null> {
    const lastId = await getSetting(LAST_ACTIVE_KEY, '');
    if (lastId) {
      const record = await db.projects.get(lastId);
      if (record) {
        setActiveProject(record.id);
        setProjectContext(createProjectContext(record));
        return record;
      }
    }
    const [mostRecent] = await this.listProjects();
    if (mostRecent) {
      setActiveProject(mostRecent.id);
      await setSetting(LAST_ACTIVE_KEY, mostRecent.id);
      setProjectContext(createProjectContext(mostRecent));
      return mostRecent;
    }
    return null;
  },

  /** Create a new project, optionally scaffolding it from a starter template. */
  async createProject(name: string, options: CreateProjectOptions = {}): Promise<ProjectRecord> {
    await bufferManager.closeAllBuffers();
    const record = await makeProjectRecord(name);
    setActiveProject(record.id);
    await setSetting(LAST_ACTIVE_KEY, record.id);
    setProjectContext(createProjectContext(record));
    await initRepo();

    if (options.templateId) {
      templateService.setFS(fs);
      const dirPath = `/projects/${record.id}`;
      await templateService.apply(options.templateId, dirPath);
    }

    return record;
  },

  /** Switch the active project. Closes open buffers — bare paths from one
   * project are meaningless in another. */
  async openProject(id: string): Promise<void> {
    const record = await db.projects.get(id);
    if (!record) throw new Error(`Unknown project: ${id}`);
    await bufferManager.closeAllBuffers();
    setActiveProject(id);
    await setSetting(LAST_ACTIVE_KEY, id);
    await db.projects.put({ ...record, updatedAt: Date.now() });
    setProjectContext(createProjectContext({ ...record, updatedAt: Date.now() }));
    await initRepo();
  },

  /** Create a project by cloning an existing git repository into it. */
  async importProject(name: string, url: string, token?: string): Promise<ProjectRecord> {
    await bufferManager.closeAllBuffers();
    const record = await makeProjectRecord(name, url);
    setActiveProject(record.id);
    await setSetting(LAST_ACTIVE_KEY, record.id);
    setProjectContext(createProjectContext(record));
    let cloneToken = token;
    if (!cloneToken && gitHubAPI.parseRemoteUrl(url)) {
      await gitHubAPI.loadToken();
      cloneToken = gitHubAPI.getAccessToken() ?? undefined;
    }
    await clone(url, cloneToken);
    return record;
  },

  async renameProject(id: string, name: string): Promise<void> {
    const record = await db.projects.get(id);
    if (!record) return;
    await db.projects.put({ ...record, name, updatedAt: Date.now() });
  },

  async deleteProjectRecord(id: string): Promise<void> {
    // Removes the project's metadata only. The underlying lightning-fs
    // directory (/projects/<id>) is left in place — deleting a whole
    // directory tree from lightning-fs recursively is a separate, riskier
    // operation than this method is meant to cover.
    await db.projects.delete(id);
  },
};
