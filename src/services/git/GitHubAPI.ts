// GitHubAPI.ts — PRs, Issues, CI status, OAuth token exchange
import { GITHUB_OAUTH_WORKER_URL } from '../../config/serviceEndpoints';
import { cryptoVault } from '../security/CryptoVault';

const OAUTH_WORKER = GITHUB_OAUTH_WORKER_URL;
const API = 'https://api.github.com';
const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID ?? 'Ov23liHoswnxGH0oVEbS';
const ENCRYPTED_TOKEN_KEY = 'devnoder-gh-token-encrypted-v1';
const LEGACY_TOKEN_KEY = 'devnoder-gh-token';

export interface GHRepo { owner: string; repo: string; }
export interface PullRequest {
  number: number; title: string; state: string;
  html_url: string; user: string; draft: boolean;
  created_at: string; mergeable?: boolean;
}
export interface Issue {
  number: number; title: string; state: string;
  html_url: string; user: string; labels: string[];
  created_at: string;
}
export interface CIRun {
  id: number; name: string; status: string;
  conclusion: string | null; html_url: string;
  created_at: string;
}

class GitHubAPI {
  private token: string | null = null;

  async setToken(t: string): Promise<void> {
    const value = t.trim();
    if (!value) throw new Error('GitHub token cannot be empty.');
    const encrypted = await cryptoVault.encrypt(value);
    localStorage.setItem(ENCRYPTED_TOKEN_KEY, encrypted);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    this.token = value;
  }

  async loadToken(): Promise<boolean> {
    if (this.token) return true;
    const encrypted = localStorage.getItem(ENCRYPTED_TOKEN_KEY);
    if (encrypted) {
      const decrypted = await cryptoVault.decrypt(encrypted);
      if (decrypted) {
        this.token = decrypted;
        return true;
      }
      localStorage.removeItem(ENCRYPTED_TOKEN_KEY);
    }

    const legacy = localStorage.getItem(LEGACY_TOKEN_KEY);
    if (!legacy) return false;
    try {
      await this.setToken(legacy);
      return true;
    } catch {
      this.token = null;
      return false;
    }
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem(ENCRYPTED_TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  }

  isAuthed() { return !!this.token; }
  getAccessToken() { return this.token; }

  async connectWithToken(token: string): Promise<void> {
    const value = token.trim();
    if (!value) throw new Error('Enter a GitHub personal access token.');
    const previous = this.token;
    this.token = value;
    try {
      await this.getUser();
    } catch {
      this.token = previous;
      throw new Error('GitHub rejected this token. Check that it is active and has the repository permissions you need.');
    }
    try {
      await this.setToken(value);
    } catch (error) {
      this.token = previous;
      throw new Error(error instanceof Error
        ? `Token is valid, but this browser could not securely store it: ${error.message}`
        : 'Token is valid, but this browser could not securely store it.', { cause: error });
    }
  }

  private headers(): HeadersInit {
    const h: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${API}${path}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`GitHub ${res.status}: ${res.statusText}`);
    return res.json();
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      method: 'POST', headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`GitHub ${res.status}: ${res.statusText}`);
    return res.json();
  }

  // OAuth PKCE flow
  startOAuth() {
    const state = crypto.randomUUID();
    sessionStorage.setItem('gh-oauth-state', state);
    const url = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo,read:user&state=${state}`;
    window.open(url, '_blank', 'width=600,height=700');
  }

  async handleOAuthCallback(code: string, state: string): Promise<boolean> {
    const saved = sessionStorage.getItem('gh-oauth-state');
    if (state !== saved) return false;
    try {
      const res = await fetch(`${OAUTH_WORKER}/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json() as { access_token?: string };
      if (res.ok && data.access_token) { await this.setToken(data.access_token); return true; }
    } catch {}
    return false;
  }

  async getUser(): Promise<{ login: string; avatar_url: string; name: string }> {
    return this.get('/user');
  }

  async getPRs({ owner, repo }: GHRepo, state: 'open' | 'closed' | 'all' = 'open'): Promise<PullRequest[]> {
    const data: any[] = await this.get(`/repos/${owner}/${repo}/pulls?state=${state}&per_page=30`);
    return data.map(pr => ({
      number: pr.number, title: pr.title, state: pr.state,
      html_url: pr.html_url, user: pr.user.login, draft: pr.draft,
      created_at: pr.created_at, mergeable: pr.mergeable,
    }));
  }

  async createPR({ owner, repo }: GHRepo, params: {
    title: string; head: string; base: string; body?: string; draft?: boolean;
  }): Promise<PullRequest> {
    return this.post(`/repos/${owner}/${repo}/pulls`, params);
  }

  async mergePR({ owner, repo }: GHRepo, number: number): Promise<void> {
    await this.post(`/repos/${owner}/${repo}/pulls/${number}/merge`, { merge_method: 'squash' });
  }

  async getIssues({ owner, repo }: GHRepo, state: 'open' | 'closed' | 'all' = 'open'): Promise<Issue[]> {
    const data: any[] = await this.get(`/repos/${owner}/${repo}/issues?state=${state}&per_page=30`);
    return data.filter(i => !i.pull_request).map(i => ({
      number: i.number, title: i.title, state: i.state,
      html_url: i.html_url, user: i.user.login,
      labels: i.labels.map((l: any) => l.name),
      created_at: i.created_at,
    }));
  }

  async createIssue({ owner, repo }: GHRepo, params: { title: string; body?: string; labels?: string[] }): Promise<Issue> {
    return this.post(`/repos/${owner}/${repo}/issues`, params);
  }

  async getCIRuns({ owner, repo }: GHRepo): Promise<CIRun[]> {
    const data: any = await this.get(`/repos/${owner}/${repo}/actions/runs?per_page=10`);
    return (data.workflow_runs ?? []).map((r: any) => ({
      id: r.id, name: r.name, status: r.status,
      conclusion: r.conclusion, html_url: r.html_url,
      created_at: r.created_at,
    }));
  }

  async getRepo({ owner, repo }: GHRepo): Promise<any> {
    return this.get(`/repos/${owner}/${repo}`);
  }

  parseRemoteUrl(url: string): GHRepo | null {
    const ssh = url.trim().match(/^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/i);
    if (ssh) return { owner: ssh[1], repo: ssh[2] };
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'github.com'
        || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length !== 2 || !/^[A-Za-z0-9_.-]+$/.test(parts[0]) || !/^[A-Za-z0-9_.-]+(?:\.git)?$/.test(parts[1])) return null;
      return { owner: parts[0], repo: parts[1].replace(/\.git$/i, '') };
    } catch {
      return null;
    }
  }
}

export const gitHubAPI = new GitHubAPI();
