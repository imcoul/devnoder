import { getSandbox, proxyToSandbox } from '@cloudflare/sandbox';

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
