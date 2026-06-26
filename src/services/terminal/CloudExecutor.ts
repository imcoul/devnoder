// CloudExecutor.ts — Cloudflare Worker fallback for execution
const WORKER_URL = 'https://devnoder-executor.srvel-build.workers.dev';

export interface CloudResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  runtime: string;
}

export const cloudExecutor = {
  available: false, // set true after user deploys worker

  async run(code: string, language: string, timeout = 10000): Promise<CloudResult> {
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
