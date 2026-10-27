import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cloudExecutor } from '../terminal/CloudExecutor';

const workingHealth = {
  status: 'ok',
  configured: true,
  capabilities: { execute: true, tunnel: true },
};

describe('CloudExecutor browser-to-Worker contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cloudExecutor.available = false;
    cloudExecutor.lastChecked = 0;
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network offline'))));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('starts unavailable when the Worker cannot be reached', async () => {
    const result = await cloudExecutor.run('print(1)', 'python');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not configured');
  });

  it('accepts only a health response advertising configured execution capability', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(workingHealth), { status: 200 }))));
    expect(await cloudExecutor.checkAvailability()).toBe(true);
    expect(cloudExecutor.available).toBe(true);
  });

  it('does not treat a live but unconfigured Worker as a usable executor', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ status: 'ok', configured: false }), { status: 200 }))));
    expect(await cloudExecutor.checkAvailability()).toBe(false);
    expect(cloudExecutor.available).toBe(false);
  });

  it('requires explicit execute capability even if the Worker otherwise reports ready', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ status: 'ok', configured: true }), { status: 200 }))));
    expect(await cloudExecutor.checkAvailability()).toBe(false);
  });

  it('handles health network errors and keeps the service unavailable', async () => {
    expect(await cloudExecutor.checkAvailability()).toBe(false);
    expect(cloudExecutor.available).toBe(false);
  });

  it('runs through the Worker only after a capability-positive health check', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(workingHealth), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ stdout: '42', stderr: '', exitCode: 0 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await cloudExecutor.run('print(1)', 'python');
    expect(result.stdout).toBe('42');
    expect(result.exitCode).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/execute');
  });

  it('turns off remote execution after an unimplemented endpoint response', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(workingHealth), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'not configured' }), { status: 501 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await cloudExecutor.run('print(1)', 'python');
    expect(result.stderr).toBe('HTTP 501');
    expect(cloudExecutor.available).toBe(false);
  });

  it('does not request a tunnel while the executor is unavailable', async () => {
    expect(await cloudExecutor.tunnel(8080)).toBe('');
  });

  it('returns a tunnel only after a positive health check', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(workingHealth), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://preview.example.test' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await cloudExecutor.tunnel(8080)).toBe('https://preview.example.test');
  });
});
