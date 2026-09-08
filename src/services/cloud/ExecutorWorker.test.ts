import { describe, expect, it } from 'vitest';

import executorWorker from '../../../devnoder-executor/index.js';
import oauthWorker from '../../../devnoder-oauth/index.js';

const json = async (response: Response) => response.json();

describe('phase 7 worker contracts', () => {
  it('exposes a real health endpoint on the executor worker', async () => {
    const response = await executorWorker.fetch(new Request('https://example.test/health'));
    expect(response.status).toBe(200);
    await expect(json(response)).resolves.toMatchObject({ status: 'ok' });
  });

  it('returns an honest 501 for unimplemented executor actions until secrets are configured', async () => {
    const response = await executorWorker.fetch(new Request('https://example.test/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'print(1)', language: 'python' }),
    }));
    expect(response.status).toBe(501);
    await expect(json(response)).resolves.toMatchObject({ error: expect.stringMatching(/not configured|not implemented/i) });
  });

  it('exposes health and validates the oauth token route contract', async () => {
    const health = await oauthWorker.fetch(new Request('https://example.test/health'));
    expect(health.status).toBe(200);
    await expect(json(health)).resolves.toMatchObject({ status: 'ok', configured: false });

    const response = await oauthWorker.fetch(new Request('https://example.test/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }));
    expect(response.status).toBe(400);
    await expect(json(response)).resolves.toMatchObject({ error: 'Missing GitHub OAuth code.' });
  });
});
