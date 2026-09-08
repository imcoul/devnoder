export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-DevNoder-Version',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === '/health') {
      return Response.json(
        { status: 'ok', version: '1.0.0', configured: false },
        { headers: corsHeaders },
      );
    }

    const unimplemented = (route, detail) => new Response(
      JSON.stringify({
        error: `The ${route} endpoint is not configured yet. ${detail}`,
        code: 'EXECUTOR_NOT_CONFIGURED',
      }),
      { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

    if (url.pathname === '/execute' && request.method === 'POST') {
      return unimplemented('/execute', 'Deploy the executor Worker, set the required secrets/bindings, and then implement the runtime contract.');
    }

    if (url.pathname === '/deploy' && request.method === 'POST') {
      return unimplemented('/deploy', 'This deploy route is intentionally disabled until the Cloudflare project is configured.');
    }

    if (url.pathname === '/skills' || url.pathname === '/templates' || url.pathname === '/pool' || url.pathname === '/billing' || url.pathname === '/billing/subscription' || url.pathname === '/billing/validate-license') {
      return unimplemented(url.pathname, 'The executor backend is still waiting for the real Cloudflare secrets and D1/R2 bindings.');
    }

    return new Response('Not found', { status: 404, headers: corsHeaders });
  }
};