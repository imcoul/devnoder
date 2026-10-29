import { describe, expect, it } from 'vitest';
import { normalizeProjectPath, DEFAULT_GIT_AUTHOR, isGitAuthorConfigured } from './GitService';

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

describe('Git commit identity', () => {
  it('uses an explicit local placeholder rather than attributing commits to Srvel', () => {
    expect(DEFAULT_GIT_AUTHOR).toEqual({ name: 'Local Developer', email: 'local@devnoder.invalid' });
    expect(isGitAuthorConfigured(DEFAULT_GIT_AUTHOR)).toBe(false);
  });

  it('accepts a user-provided email or GitHub noreply address', () => {
    expect(isGitAuthorConfigured({ name: 'Example Developer', email: 'developer@example.com' })).toBe(true);
    expect(isGitAuthorConfigured({ name: 'Example Developer', email: '12345+dev@users.noreply.github.com' })).toBe(true);
  });

  it('rejects empty, malformed, overlong, and control-character identities', () => {
    expect(isGitAuthorConfigured({ name: 'Developer', email: 'local@devnoder.invalid' })).toBe(false);
    expect(isGitAuthorConfigured({ name: 'Developer', email: 'not-an-email' })).toBe(false);
    expect(isGitAuthorConfigured({ name: '', email: 'developer@example.com' })).toBe(false);
    expect(isGitAuthorConfigured({ name: `A${'a'.repeat(100)}`, email: 'developer@example.com' })).toBe(false);
    expect(isGitAuthorConfigured({ name: 'Developer\nInjected', email: 'developer@example.com' })).toBe(false);
  });
});
