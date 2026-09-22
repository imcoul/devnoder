// projectContext.ts — single source of truth for the active project.
//
// Problem: project state was scattered across:
//   - GitService.activeProjectId + getDir()
//   - BufferManager.$activeBuffer + $buffers
//   - ProjectService.lastActiveProjectId setting
//   - TerminalSession.cwd
//   - MCPClient per-project connections
//
// Solution: one atom tree that composes all project-scoped state.
// Consumers subscribe to changes instead of polling multiple stores.

import { atom } from 'nanostores';
import type { ProjectRecord } from '../services/storage/db';
import type { FileStatus, Branch } from '../services/git/GitService';
import type { Buffer } from '../services/editor/BufferManager';
import type { MCPServerConfig } from '../services/ai/MCPConfigStore';

export interface ProjectGitState {
  status: FileStatus[];
  branches: Branch[];
  currentBranch?: string;
  remote?: string;
}

export interface ProjectTerminalState {
  cwd: string;
  env: Record<string, string>;
}

export interface ProjectMCPState {
  connectedServers: MCPServerConfig[];
}

export interface ProjectUIState {
  activePanel: string;
  sidebarOpen: boolean;
}

export interface ProjectContext {
  project: ProjectRecord | null;
  git: ProjectGitState;
  buffers: Buffer[];
  terminal: ProjectTerminalState;
  mcp: ProjectMCPState;
  ui: ProjectUIState;
}

export const $projectContext = atom<ProjectContext | null>(null);

export const $activeProjectId = atom<string | null>(null);
export const $gitStatus = atom<FileStatus[]>([]);
export const $activeBuffer = atom<Buffer | null>(null);
export const $currentBranch = atom<string | null>(null);
export const $terminalCwd = atom<string>('/devnoder');

export function setProjectContext(ctx: ProjectContext | null) {
  $projectContext.set(ctx);
  if (ctx?.project?.id) {
    $activeProjectId.set(ctx.project.id);
  } else {
    $activeProjectId.set(null);
  }
  $gitStatus.set(ctx?.git.status ?? []);
  $activeBuffer.set(ctx?.buffers.find(b => b.id === ctx?.ui?.activePanel) ?? null);
  $currentBranch.set(ctx?.git.currentBranch ?? null);
  $terminalCwd.set(ctx?.terminal.cwd ?? '/devnoder');
}

export function updateProjectGitStatus(status: FileStatus[]) {
  $gitStatus.set(status);
  const ctx = $projectContext.get();
  if (ctx) {
    $projectContext.set({ ...ctx, git: { ...ctx.git, status } });
  }
}

export function updateActiveBuffer(bufferId: string | null) {
  const ctx = $projectContext.get();
  if (!ctx) return;
  const buffer = ctx.buffers.find(b => b.id === bufferId) ?? null;
  $activeBuffer.set(buffer);
  $projectContext.set({
    ...ctx,
    ui: { ...ctx.ui, activePanel: bufferId ?? '' },
  });
}

export function updateTerminalCwd(cwd: string) {
  $terminalCwd.set(cwd);
  const ctx = $projectContext.get();
  if (ctx) {
    $projectContext.set({
      ...ctx,
      terminal: { ...ctx.terminal, cwd },
    });
  }
}

export function createProjectContext(project: ProjectRecord): ProjectContext {
  return {
    project,
    git: {
      status: [],
      branches: [],
      currentBranch: undefined,
      remote: project.gitRemote,
    },
    buffers: [],
    terminal: {
      cwd: `/projects/${project.id}`,
      env: { PATH: '/usr/bin:/bin', HOME: '/root', TERM: 'xterm-256color' },
    },
    mcp: {
      connectedServers: [],
    },
    ui: {
      activePanel: '',
      sidebarOpen: false,
    },
  };
}
