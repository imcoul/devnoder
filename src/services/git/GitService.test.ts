import { describe, expect, it } from 'vitest';
import { normalizeProjectPath } from './GitService';

describe('normalizeProjectPath', () => {
  it('accepts ordinary project-relative nested paths', () => {
    expect(normalizeProjectPath('src/components/main.tsx')).toBe('src/components/main.tsx');
    expect(normalizeProjectPath('assets/hello world.txt')).toBe('assets/hello world.txt');
  });

  it.each([
    '',
    '/etc/passwd',
    '../outside.txt',
    'src/../../outside.txt',
    './index.ts',
    'src//main.ts',
    'C:/outside.txt',
    'src\\main.ts',
    'src/invalid\u0000name.ts',
  ])('rejects unsafe path %j', path => {
    expect(() => normalizeProjectPath(path)).toThrow();
  });
});
