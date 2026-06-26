// GitHubAPI.ts — PRs, Issues, CI status, OAuth token exchange
const OAUTH_WORKER = 'https://devnoder-oauth.srvel-build.workers.dev';
const API = 'https://api.github.com';
// MANUAL: replace with your GitHub OAuth App client ID
const CLIENT_ID = 'REPLACE_WITH_GITHUB_OAUTH_CLIENT_ID';

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

  setToken(t: string) {
    this.token = t;
    localStorage.setItem('devnoder-gh-token', t);
  }
  loadToken() {
    this.token = localStorage.getItem('devnoder-gh-token');
    return !!this.token;
  }
  clearToken() { this.token = null; localStorage.removeItem('devnoder-gh-token'); }
  isAuthed() { return !!this.token; }

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
      const data = await res.json();
      if (data.access_token) { this.setToken(data.access_token); return true; }
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
    const m = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (!m) return null;
    return { owner: m[1], repo: m[2].replace(/\.git$/, '') };
  }
}

export const gitHubAPI = new GitHubAPI();
