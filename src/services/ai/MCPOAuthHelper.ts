// MCPOAuthHelper.ts — browser-side OAuth authorization-code flow for MCP servers.
import { mcpConfigStore, type MCPOAuthToken } from './MCPConfigStore';

export interface OAuthFlowOptions {
  authUrl: string;
  redirectUri?: string;
  scopes?: string[];
  onSuccess?: (token: MCPOAuthToken) => void;
  onError?: (error: Error) => void;
}

export class MCPOAuthHelper {
  async startFlow(serverId: string, opts: OAuthFlowOptions): Promise<MCPOAuthToken | undefined> {
    const redirectUri = opts.redirectUri ?? `${location.origin}/oauth/callback`;
    const url = new URL(opts.authUrl);
    url.searchParams.set('redirect_uri', redirectUri);
    if (opts.scopes?.length) url.searchParams.set('scope', opts.scopes.join(' '));

    const popup = window.open(url.toString(), 'devnoder-oauth', 'width=500,height=700');
    if (!popup) {
      opts.onError?.(new Error('Popup blocked — allow popups for this site'));
      return undefined;
    }

    return new Promise((resolve) => {
      const poll = setInterval(async () => {
        try {
          if (popup.closed) {
            clearInterval(poll);
            opts.onError?.(new Error('OAuth flow cancelled'));
            return;
          }
          const href = popup.location.href;
          if (href.startsWith(redirectUri)) {
            clearInterval(poll);
            popup.close();
            const u = new URL(href);
            const code = u.searchParams.get('code');
            const error = u.searchParams.get('error');
            if (error) {
              opts.onError?.(new Error(error));
              return;
            }
            if (!code) {
              opts.onError?.(new Error('No authorization code in callback'));
              return;
            }
            const token = await this.exchangeCode(serverId, code, opts.authUrl);
            if (token) {
              await mcpConfigStore.setOAuthToken(serverId, token);
              opts.onSuccess?.(token);
              resolve(token);
            }
          }
        } catch {
          // popup.location.href throws on cross-origin until the redirect lands
        }
      }, 300);
    });
  }

  async exchangeCode(serverId: string, code: string, authUrl: string): Promise<Omit<MCPOAuthToken, 'id'> | undefined> {
    // Placeholder: real implementation needs a token endpoint from the MCP server's
    // OAuth discovery metadata. For Sprint 2 we persist the code and leave the
    // actual token exchange to a backend proxy or a future phase.
    console.warn('[MCPOAuthHelper] token exchange not implemented — code:', code);
    return {
      serverId,
      accessToken: `pending-${code}`,
      expiresAt: Date.now() + 3600_000,
      scope: '',
    };
  }

  async getToken(serverId: string): Promise<MCPOAuthToken | undefined> {
    return mcpConfigStore.getOAuthToken(serverId);
  }

  async revoke(serverId: string): Promise<void> {
    await mcpConfigStore.deleteOAuthToken(serverId);
  }
}

export const oauthHelper = new MCPOAuthHelper();
