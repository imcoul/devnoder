// ProjectService.ts — project lifecycle on top of db.projects + GitService's
// per-project directory scoping. This is the thing that was missing entirely:
// db.projects was defined but never read or written anywhere before this file.
import { db, ProjectRecord } from '../storage/db';
import {
  fs, initRepo, clone, stageAll, commit, setActiveProject,
} from '../git/GitService';
import { templateService } from '../templates/TemplateService';
import { bufferManager } from '../editor/BufferManager';

export interface CreateProjectOptions {
  templateId?: string;
}

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

  async hasAnyProject(): Promise<boolean> {
    return (await db.projects.count()) > 0;
  },

  /** Create a new project, optionally scaffolding it from a starter template. */
  async createProject(name: string, options: CreateProjectOptions = {}): Promise<ProjectRecord> {
    const record = await makeProjectRecord(name);
    bufferManager.closeAllBuffers();
    setActiveProject(record.id);
    await initRepo();

    if (options.templateId) {
      templateService.setFS(fs);
      const dirPath = `/projects/${record.id}`;
      const { errors } = await templateService.apply(options.templateId, dirPath);
      if (errors.length === 0) {
        await stageAll();
        await commit(`Initial commit from template: ${options.templateId}`);
      }
    }

    return record;
  },

  /** Switch the active project. Closes open buffers — bare paths from one
   * project are meaningless in another. */
  async openProject(id: string): Promise<void> {
    const record = await db.projects.get(id);
    if (!record) throw new Error(`Unknown project: ${id}`);
    bufferManager.closeAllBuffers();
    setActiveProject(id);
    await db.projects.put({ ...record, updatedAt: Date.now() });
    await initRepo();
  },

  /** Create a project by cloning an existing git repository into it. */
  async importProject(name: string, url: string, token?: string): Promise<ProjectRecord> {
    const record = await makeProjectRecord(name, url);
    bufferManager.closeAllBuffers();
    setActiveProject(record.id);
    await clone(url, token);
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
