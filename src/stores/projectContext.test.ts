import { describe, it, expect, vi } from 'vitest';
import {
  $projectContext,
  $activeProjectId,
  $gitStatus,
  $activeBuffer,
  $currentBranch,
  $terminalCwd,
  setProjectContext,
  updateProjectGitStatus,
  updateActiveBuffer,
  updateTerminalCwd,
  createProjectContext,
  type ProjectContext,
} from './projectContext';

describe('projectContext', () => {
  it('starts with null context', () => {
    expect($projectContext.get()).toBeNull();
    expect($activeProjectId.get()).toBeNull();
    expect($gitStatus.get()).toEqual([]);
    expect($activeBuffer.get()).toBeNull();
    expect($currentBranch.get()).toBeNull();
    expect($terminalCwd.get()).toBe('/devnoder');
  });

  it('setProjectContext updates all atoms', () => {
    const ctx = createProjectContext({
      id: 'proj-1',
      name: 'Test Project',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setProjectContext(ctx);
    expect(($projectContext.get() as any).project.id).toBe('proj-1');
    expect($activeProjectId.get()).toBe('proj-1');
    expect($terminalCwd.get()).toBe('/projects/proj-1');
  });

  it('setProjectContext with null clears active project', () => {
    setProjectContext(null);
    expect($activeProjectId.get()).toBeNull();
    expect($terminalCwd.get()).toBe('/devnoder');
  });

  it('updateProjectGitStatus updates git status atom', () => {
    const ctx = createProjectContext({
      id: 'proj-1',
      name: 'Test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setProjectContext(ctx);
    updateProjectGitStatus([{ path: 'foo.ts', status: 'modified', staged: false }]);
    expect($gitStatus.get()).toHaveLength(1);
    expect($gitStatus.get()[0].path).toBe('foo.ts');
  });

  it('updateActiveBuffer switches active buffer', () => {
    const buffer = {
      id: 'buf-1',
      path: 'src/index.ts',
      filename: 'index.ts',
      content: 'console.log(1)',
      language: 'typescript',
      dirty: false,
      cursorLine: 1,
      cursorCol: 1,
      scrollTop: 0,
    };
    const ctx = createProjectContext({
      id: 'proj-1',
      name: 'Test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setProjectContext({
      ...ctx,
      buffers: [buffer],
      ui: { activePanel: 'buf-1', sidebarOpen: false },
    });
    expect($activeBuffer.get()?.id).toBe('buf-1');
    updateActiveBuffer(null);
    expect($activeBuffer.get()).toBeNull();
  });

  it('updateTerminalCwd updates terminal cwd', () => {
    const ctx = createProjectContext({
      id: 'proj-1',
      name: 'Test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setProjectContext(ctx);
    updateTerminalCwd('/projects/proj-1/src');
    expect($terminalCwd.get()).toBe('/projects/proj-1/src');
  });

  it('createProjectContext sets sensible defaults', () => {
    const ctx = createProjectContext({
      id: 'proj-1',
      name: 'Test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      gitRemote: 'https://github.com/test/repo.git',
    });
    expect(ctx.git.remote).toBe('https://github.com/test/repo.git');
    expect(ctx.terminal.env.PATH).toBe('/usr/bin:/bin');
    expect(ctx.terminal.env.TERM).toBe('xterm-256color');
    expect(ctx.mcp.connectedServers).toEqual([]);
  });
});
