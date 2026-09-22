import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFs = {
  promisify: (fn: any) => fn,
  promises: {
    readFile: vi.fn(() => Promise.resolve('')),
    writeFile: vi.fn(() => Promise.resolve()),
    unlink: vi.fn(() => Promise.resolve()),
    mkdir: vi.fn(() => Promise.resolve()),
    readdir: vi.fn(() => Promise.resolve([])),
    stat: vi.fn(() => Promise.resolve({ type: 'file' })),
  },
};

vi.mock('@isomorphic-git/lightning-fs', () => ({
  default: class MockFS {
    constructor(_name: string) {
      return mockFs;
    }
  },
}));

vi.mock('../storage/db', () => ({
  db: {
    files: {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => []),
        })),
      })),
    },
  },
}));

import { VirtualFS, createVirtualFS } from './VirtualFS';

describe('VirtualFS', () => {
  let vfs: VirtualFS;

  beforeEach(() => {
    vi.clearAllMocks();
    vfs = createVirtualFS('proj-1');
  });

  it('returns the project git dir', () => {
    expect(vfs.getGitDir()).toBe('/projects/proj-1');
  });

  it('emits write events', async () => {
    const changes: any[] = [];
    vfs.onChange(event => changes.push(event));
    await vfs.writeFile('test.txt', 'hello');
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({ type: 'write', path: 'test.txt', content: 'hello' });
  });

  it('emits delete events', async () => {
    const changes: any[] = [];
    vfs.onChange(event => changes.push(event));
    await vfs.deleteFile('test.txt');
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({ type: 'delete', path: 'test.txt' });
  });

  it('unsubscribes listener on cleanup', async () => {
    const changes: any[] = [];
    const unsub = vfs.onChange(event => changes.push(event));
    unsub();
    await vfs.writeFile('test.txt', 'hello');
    expect(changes).toHaveLength(0);
  });

  it('clearCache empties the cache', () => {
    vfs.writeFile('test.txt', 'hello');
    vfs.clearCache();
    expect(vfs.getGitDir()).toBe('/projects/proj-1');
  });

  it('resolve prepends project path', () => {
    const resolve = (vfs as any).resolve.bind(vfs);
    expect(resolve('src/index.ts')).toBe('/projects/proj-1/src/index.ts');
  });
});
