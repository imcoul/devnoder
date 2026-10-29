// CloudExecutor.ts — browser-safe client for the optional remote executor Worker.
// The Cloudflare Sandbox SDK is server-only and must remain inside Worker code.
import { EXECUTOR_BASE_URL } from '../../config/serviceEndpoints';

export interface CloudResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  runtime: string;
}

interface ExecutorHealth {
  status?: string;
  configured?: boolean;
  capabilities?: { execute?: boolean; tunnel?: boolean };
}

export const cloudExecutor = {
  available: false,
  lastChecked: 0,

  async checkAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${EXECUTOR_BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
      const health = response.ok ? await response.json() as ExecutorHealth : null;
      this.available = response.ok
        && health?.status === 'ok'
        && health.configured === true
        && health.capabilities?.execute === true;
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

  async run(code: string, language: string, timeout = 10_000): Promise<CloudResult> {
    if (!await this.ensureFresh()) {
      return { stdout: '', stderr: 'Remote executor is not configured or does not advertise execute capability.', exitCode: 1, runtime: language };
    }
    try {
      const response = await fetch(`${EXECUTOR_BASE_URL}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
        signal: AbortSignal.timeout(timeout),
      });
      if (!response.ok) {
        if ([401, 403, 404, 501].includes(response.status)) {
          this.available = false;
          this.lastChecked = Date.now();
        }
        return { stdout: '', stderr: `HTTP ${response.status}`, exitCode: 1, runtime: language };
      }
      const result = await response.json() as Partial<CloudResult>;
      return {
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
        exitCode: result.exitCode ?? 0,
        runtime: result.runtime ?? language,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { stdout: '', stderr: message, exitCode: 1, runtime: language };
    }
  },

  async tunnel(port: number): Promise<string> {
    if (!await this.ensureFresh()) return '';
    try {
      const response = await fetch(`${EXECUTOR_BASE_URL}/tunnel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return '';
      const data = await response.json() as { url?: string };
      return data.url ?? '';
    } catch {
      return '';
    }
  },

  setAvailable(value: boolean) {
    this.available = value;
  },
};
