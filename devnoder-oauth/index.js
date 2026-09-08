export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      return Response.json(
        { status: 'ok', configured: Boolean(env?.GITHUB_CLIENT_ID && env?.GITHUB_CLIENT_SECRET) },
        { headers: corsHeaders },
      );
    }

    if (url.pathname === '/token' && request.method === 'POST') {
      const { code } = await request.json().catch(() => ({}));

      if (!code) {
        return Response.json(
          { error: 'Missing GitHub OAuth code.' },
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const clientId = env?.GITHUB_CLIENT_ID;
      const clientSecret = env?.GITHUB_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return Response.json(
          {
            error: 'GitHub OAuth is not configured yet. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET on the Worker before exchanging a code.',
            code: 'OAUTH_NOT_CONFIGURED',
          },
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const githubResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      });
      const payload = await githubResponse.json();
      return Response.json(payload, {
        status: githubResponse.status,
        headers: corsHeaders,
      });
    }

    if (url.pathname === '/exchange' && request.method === 'POST') {
      return Response.json(
        {
          error: 'Legacy /exchange route is deprecated; use /token and configure the Worker secret first.',
          code: 'OAUTH_NOT_CONFIGURED',
        },
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response('Not found', { status: 404, headers: corsHeaders });
  }
};