import { describe, expect, it, vi } from 'vitest';
import { cloudExecutor, type CloudResult } from '../terminal/CloudExecutor';

vi.mock('@cloudflare/sandbox', () => ({
  getSandbox: vi.fn(() => ({
    exec: vi.fn(),
    tunnels: { get: vi.fn() },
  })),
  proxyToSandbox: vi.fn(async () => null),
  Sandbox: class Sandbox {},
}));

describe('CloudExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cloudExecutor.available = false;
    cloudExecutor.lastChecked = 0;
    cloudExecutor.sandboxReady = false;
    cloudExecutor.sandboxInstance = null;
  });

  it('starts unavailable by default', async () => {
    const result = await cloudExecutor.run('print(1)', 'python');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not deployed');
  });

  it('checkAvailability probes fallback worker', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }))
    ) as any;
    const available = await cloudExecutor.checkAvailability();
    expect(available).toBe(true);
    expect(cloudExecutor.available).toBe(true);
  });

  it('checkAvailability handles network errors', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('network'))) as any;
    const available = await cloudExecutor.checkAvailability();
    expect(available).toBe(false);
    expect(cloudExecutor.available).toBe(false);
  });

  it('tunnels returns empty when unavailable', async () => {
    const url = await cloudExecutor.tunnel(8080);
    expect(url).toBe('');
  });

  it('uses sandbox when initialized', async () => {
    const mockSandbox = {
      exec: vi.fn(() => Promise.resolve({ stdout: '42', stderr: '', exitCode: 0, success: true, command: '' })),
      tunnels: { get: vi.fn(() => Promise.resolve({ url: 'https://test.trycloudflare.com' })) },
    };
    cloudExecutor.sandboxReady = true;
    cloudExecutor.sandboxInstance = mockSandbox as any;

    const result = await cloudExecutor.run('python', 'python');
    expect(mockSandbox.exec).toHaveBeenCalledWith('python', { timeout: 10000 });
    expect(result.stdout).toBe('42');
    expect(result.exitCode).toBe(0);
  });
});
