import { getSandbox, proxyToSandbox, proxyTerminal, type PtyOptions } from '@cloudflare/sandbox';

const DEFAULT_SANDBOX_ID = 'devnoder-default';

export { Sandbox } from '@cloudflare/sandbox';

export default {
  async fetch(request, env) {
    const proxyResponse = await proxyToSandbox(request, env);
    if (proxyResponse) return proxyResponse;

    const url = new URL(request.url);
    const sandbox = getSandbox(env.Sandbox, DEFAULT_SANDBOX_ID);

    if (url.pathname === '/health' && request.method === 'GET') {
      return Response.json(
        { status: 'ok', version: '1.0.0', configured: true },
        { headers: corsHeaders() },
      );
    }

    // WebSocket terminal proxy: /ws/terminal/:sessionId
    if (url.pathname.startsWith('/ws/terminal/') && request.headers.get('Upgrade') === 'websocket') {
      const sessionId = url.pathname.replace('/ws/terminal/', '') || 'default';
      const options: PtyOptions = {
        cols: parseInt(request.headers.get('X-Terminal-Cols') || '80', 10),
        rows: parseInt(request.headers.get('X-Terminal-Rows') || '24', 10),
        shell: '/bin/bash',
      };
      try {
        return await proxyTerminal(sandbox as any, sessionId, request, options);
      } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
      }
    }

    const unimplemented = (route, detail) =>
      new Response(
        JSON.stringify({
          error: `The ${route} endpoint is not configured yet. ${detail}`,
          code: 'EXECUTOR_NOT_CONFIGURED',
        }),
        { status: 501, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } },
      );

    if (url.pathname === '/execute' && request.method === 'POST') {
      return unimplemented('/execute', 'Implement runtime contract with Sandbox.exec().');
    }

    if (url.pathname === '/deploy' && request.method === 'POST') {
      return unimplemented('/deploy', 'This deploy route is intentionally disabled until configured.');
    }

    if (['/skills', '/templates', '/pool', '/billing', '/billing/subscription', '/billing/validate-license'].includes(url.pathname)) {
      return unimplemented(url.pathname, 'Waiting for real Cloudflare secrets and D1/R2 bindings.');
    }

    return new Response('Not found', { status: 404, headers: corsHeaders() });
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-DevNoder-Version',
  };
}
