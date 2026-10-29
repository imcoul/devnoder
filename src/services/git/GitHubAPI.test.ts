import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../security/CryptoVault', () => ({
  cryptoVault: {
    encrypt: vi.fn(async (value: string) => `enc:${value}`),
    decrypt: vi.fn(async (value: string) => value.startsWith('enc:') ? value.slice(4) : null),
  },
}));

import { gitHubAPI } from './GitHubAPI';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); },
  } as Storage;
}

let storage: Storage;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  gitHubAPI.clearToken();
});

afterEach(() => {
  gitHubAPI.clearToken();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('GitHubAPI credential handling', () => {
  it('encrypts tokens at rest and migrates the legacy plaintext key', async () => {
    await gitHubAPI.setToken('secret-token');
    expect(storage.getItem('devnoder-gh-token-encrypted-v1')).toBe('enc:secret-token');
    expect(storage.getItem('devnoder-gh-token')).toBeNull();

    gitHubAPI.clearToken();
    storage.setItem('devnoder-gh-token', 'legacy-token');
    await expect(gitHubAPI.loadToken()).resolves.toBe(true);
    expect(gitHubAPI.getAccessToken()).toBe('legacy-token');
    expect(storage.getItem('devnoder-gh-token-encrypted-v1')).toBe('enc:legacy-token');
    expect(storage.getItem('devnoder-gh-token')).toBeNull();
  });

  it('validates a user token before encrypting and persisting it', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ login: 'devuser' }), { status: 200 }));
    await gitHubAPI.connectWithToken(' fine-grained-token ');
    expect(fetchMock).toHaveBeenCalledWith('https://api.github.com/user', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer fine-grained-token' }),
    }));
    expect(gitHubAPI.getAccessToken()).toBe('fine-grained-token');
    expect(storage.getItem('devnoder-gh-token-encrypted-v1')).toBe('enc:fine-grained-token');
  });

  it('does not persist a token rejected by GitHub', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 }));
    await expect(gitHubAPI.connectWithToken('bad-token')).rejects.toThrow('GitHub rejected this token');
    expect(storage.getItem('devnoder-gh-token-encrypted-v1')).toBeNull();
    expect(gitHubAPI.isAuthed()).toBe(false);
  });

  it('accepts only github.com repository remotes and rejects embedded credentials', () => {
    expect(gitHubAPI.parseRemoteUrl('https://github.com/owner/repo.git')).toEqual({ owner: 'owner', repo: 'repo' });
    expect(gitHubAPI.parseRemoteUrl('git@github.com:owner/repo.git')).toEqual({ owner: 'owner', repo: 'repo' });
    expect(gitHubAPI.parseRemoteUrl('https://github.com.attacker.example/owner/repo')).toBeNull();
    expect(gitHubAPI.parseRemoteUrl('https://user:token@github.com/owner/repo')).toBeNull();
    expect(gitHubAPI.parseRemoteUrl('https://github.com/owner/repo?token=secret')).toBeNull();
  });
});
