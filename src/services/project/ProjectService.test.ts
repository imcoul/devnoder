import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../storage/db', () => {
  const get = vi.fn();
  const put = vi.fn();
  const delete_ = vi.fn();
  const projects = {
    orderBy: vi.fn(() => ({
      reverse: vi.fn(() => ({
        toArray: vi.fn(() => []),
      })),
    })),
    get,
    put,
    delete: delete_,
  };
  return {
    db: { projects },
    getSetting: vi.fn(),
    setSetting: vi.fn(),
  };
});

vi.mock('../git/GitService', () => ({
  fs: {},
  initRepo: vi.fn(),
  setActiveProject: vi.fn(),
  clone: vi.fn(),
  stageAll: vi.fn(),
  commit: vi.fn(),
}));

vi.mock('../templates/TemplateService', () => ({
  templateService: {
    apply: vi.fn(() => Promise.resolve({ errors: [] })),
    setFS: vi.fn(),
  },
}));

vi.mock('../editor/BufferManager', () => ({
  bufferManager: { closeAllBuffers: vi.fn() },
}));

vi.mock('../../stores/projectContext', () => ({
  setProjectContext: vi.fn(),
  createProjectContext: vi.fn(() => ({
    project: { id: 'p1', name: 'Test', createdAt: Date.now(), updatedAt: Date.now() },
    git: {},
    buffers: [],
    terminal: {},
    mcp: {},
    ui: {},
  })),
}));

import { projectService } from '../project/ProjectService';

describe('ProjectService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createProject creates a project record', async () => {
    const record = await projectService.createProject('My Project');
    expect(record.name).toBe('My Project');
    expect(record.id).toBeDefined();
  });

  it('createProject with template applies template', async () => {
    const record = await projectService.createProject('My Project', { templateId: 'react' });
    expect(record.name).toBe('My Project');
  });

  it('openProject switches active project', async () => {
    const { db } = await import('../storage/db');
    const mockRecord = { id: 'p1', name: 'Test', createdAt: Date.now(), updatedAt: Date.now() };
    (db.projects.get as any).mockResolvedValue(mockRecord);
    await projectService.openProject('p1');
    expect(db.projects.get).toHaveBeenCalledWith('p1');
  });

  it('openProject throws for unknown project', async () => {
    const { db } = await import('../storage/db');
    (db.projects.get as any).mockResolvedValue(undefined);
    await expect(projectService.openProject('unknown')).rejects.toThrow('Unknown project');
  });

  it('importProject creates project and clones', async () => {
    const record = await projectService.importProject('Imported', 'https://github.com/test/repo.git');
    expect(record.name).toBe('Imported');
    expect(record.gitRemote).toBe('https://github.com/test/repo.git');
  });

  it('renameProject updates name', async () => {
    const { db } = await import('../storage/db');
    const mockRecord = { id: 'p1', name: 'Old', createdAt: Date.now(), updatedAt: Date.now() };
    (db.projects.get as any).mockResolvedValue(mockRecord);
    await projectService.renameProject('p1', 'New');
    expect(db.projects.put).toHaveBeenCalled();
  });

  it('deleteProjectRecord removes from db', async () => {
    const { db } = await import('../storage/db');
    await projectService.deleteProjectRecord('p1');
    expect(db.projects.delete).toHaveBeenCalledWith('p1');
  });
});
