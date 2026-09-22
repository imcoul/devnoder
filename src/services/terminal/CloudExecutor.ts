// CloudExecutor.ts — Cloudflare Sandbox SDK integration for code execution.
//
// Task 1.1: Adopt @cloudflare/sandbox (Apache-2.0).
//   - Replaces the old HTTP-only CloudExecutor with the SDK's DO-backed API.
//   - Falls back to HTTP worker URL when Sandbox binding is absent (local dev,
//     preview deployments without DO, or before wrangler.toml is updated).

import { getSandbox, type Sandbox, type SandboxOptions, type ExecResult } from '@cloudflare/sandbox';

export interface CloudResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  runtime: string;
}

const FALLBACK_WORKER_URL = 'https://devnoder-executor.srvel-build.workers.dev';
const DEFAULT_SANDBOX_ID = 'devnoder-default';
const DEFAULT_SESSION_ID = 'default';

export const cloudExecutor = {
  available: false,
  lastChecked: 0,
  sandboxReady: false as boolean,
  sandboxInstance: null as Sandbox | null,

  /** Detect whether the Sandbox DO binding is available at runtime. */
  hasBinding(env: unknown): boolean {
    if (typeof env !== 'object' || env === null) return false;
    const candidate = (env as Record<string, unknown>).Sandbox;
    return !!candidate && typeof (candidate as Record<string, unknown>).idFromName === 'function' && typeof (candidate as Record<string, unknown>).get === 'function';
  },

  /** Initialize the sandbox from a Cloudflare env binding. */
  initSandbox(env: Record<string, unknown>, options?: SandboxOptions) {
    this.sandboxInstance = getSandbox(env.Sandbox as any, DEFAULT_SANDBOX_ID, options);
    this.sandboxReady = true;
  },

  async checkAvailability(): Promise<boolean> {
    if (this.sandboxReady) {
      this.available = true;
      this.lastChecked = Date.now();
      return true;
    }
    try {
      const res = await fetch(`${FALLBACK_WORKER_URL}/health`, { signal: AbortSignal.timeout(3000) });
      this.available = res.ok;
    } catch {
      this.available = false;
    }
    this.lastChecked = Date.now();
    return this.available;
  },

  async ensureFresh(maxAgeMs = 60_000): Promise<boolean> {
    if (Date.now() - this.lastChecked > maxAgeMs) await this.checkAvailability();
    return this.available;
  },

  async run(code: string, language: string, timeout = 10000): Promise<CloudResult> {
    if (this.sandboxReady && this.sandboxInstance) {
      try {
        const result: ExecResult = await this.sandboxInstance.exec(code, { timeout });
        return {
          stdout: result.stdout ?? '',
          stderr: result.stderr ?? '',
          exitCode: result.exitCode ?? 0,
          runtime: language,
        };
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return { stdout: '', stderr: message, exitCode: 1, runtime: language };
      }
    }
    await this.ensureFresh();
    if (!this.available) {
      return { stdout: '', stderr: 'Cloud executor not deployed.', exitCode: 1, runtime: language };
    }
    try {
      const res = await fetch(`${FALLBACK_WORKER_URL}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
        signal: AbortSignal.timeout(timeout),
      });
      return res.ok ? (await res.json()) : { stdout: '', stderr: `HTTP ${res.status}`, exitCode: 1, runtime: language };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { stdout: '', stderr: message, exitCode: 1, runtime: language };
    }
  },

  async tunnel(port: number): Promise<string> {
    if (this.sandboxReady && this.sandboxInstance) {
      try {
        const tunnel = await this.sandboxInstance.tunnels.get(port);
        return tunnel.url ?? '';
      } catch {
        return '';
      }
    }
    try {
      const res = await fetch(`${FALLBACK_WORKER_URL}/tunnel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port }),
      });
      const data = await res.json();
      return data.url ?? '';
    } catch {
      return '';
    }
  },

  setAvailable(v: boolean) {
    this.available = v;
  },
};
