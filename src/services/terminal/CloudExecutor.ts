// CloudExecutor.ts — Cloudflare Worker fallback for execution
const WORKER_URL = 'https://devnoder-executor.srvel-build.workers.dev';

export interface CloudResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  runtime: string;
}

export const cloudExecutor = {
  available: false,
  lastChecked: 0,

  /** Real liveness probe against the executor Worker's /health route.
   * Replaces a hardcoded flag nothing ever flipped — this at least tells
   * the truth about whether the Worker is actually reachable. */
  async checkAvailability(): Promise<boolean> {
    try {
      const res = await fetch(`${WORKER_URL}/health`, { signal: AbortSignal.timeout(3000) });
      this.available = res.ok;
    } catch {
      this.available = false;
    }
    this.lastChecked = Date.now();
    return this.available;
  },

  /** Re-check if the last probe is stale (default: older than 60s). */
  async ensureFresh(maxAgeMs = 60_000): Promise<boolean> {
    if (Date.now() - this.lastChecked > maxAgeMs) await this.checkAvailability();
    return this.available;
  },

  async run(code: string, language: string, timeout = 10000): Promise<CloudResult> {
    await this.ensureFresh();
    if (!this.available) {
      return { stdout: '', stderr: 'Cloud executor not deployed. See manual tasks.', exitCode: 1, runtime: language };
    }
    try {
      const res = await fetch(`${WORKER_URL}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
        signal: AbortSignal.timeout(timeout),
      });
      return res.ok ? res.json() : { stdout: '', stderr: `HTTP ${res.status}`, exitCode: 1, runtime: language };
    } catch (e: any) {
      return { stdout: '', stderr: e.message, exitCode: 1, runtime: language };
    }
  },

  async tunnel(port: number): Promise<string> {
    try {
      const res = await fetch(`${WORKER_URL}/tunnel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port }),
      });
      const data = await res.json();
      return data.url ?? '';
    } catch { return ''; }
  },

  setAvailable(v: boolean) { this.available = v; },
};
