import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./ProjectService', () => ({
  projectService: { createProject: vi.fn(async (name: string) => ({ id: 'starter-1', name, createdAt: 1, updatedAt: 1 })) },
}));
vi.mock('../git/GitService', () => ({
  writeFile: vi.fn(),
  stageAll: vi.fn(),
  commit: vi.fn(),
}));
vi.mock('../editor/BufferManager', () => ({
  bufferManager: { open: vi.fn() },
}));

import { projectService } from './ProjectService';
import { writeFile, stageAll, commit } from '../git/GitService';
import { bufferManager } from '../editor/BufferManager';
import { STARTER_PROJECT_FILES, createStarterProject } from './StarterProject';

describe('createStarterProject', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a project, writes the browser starter, and opens index.html', async () => {
    const project = await createStarterProject('  My Web Project  ');

    expect(projectService.createProject).toHaveBeenCalledWith('My Web Project');
    expect(writeFile).toHaveBeenCalledTimes(3);
    expect(writeFile).toHaveBeenCalledWith('index.html', STARTER_PROJECT_FILES['index.html']);
    expect(writeFile).toHaveBeenCalledWith('style.css', STARTER_PROJECT_FILES['style.css']);
    expect(writeFile).toHaveBeenCalledWith('app.js', STARTER_PROJECT_FILES['app.js']);
    expect(stageAll).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
    expect(bufferManager.open).toHaveBeenCalledWith('index.html', STARTER_PROJECT_FILES['index.html'], 'html');
    expect(project.name).toBe('My Web Project');
  });
});
