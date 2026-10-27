const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

/** Public endpoints only. Never put tokens or other secrets in VITE_ variables. */
export const EXECUTOR_BASE_URL = stripTrailingSlash(
  import.meta.env.VITE_EXECUTOR_URL ?? 'https://devnoder-executor.ibrahimmamadoucoulibaly.workers.dev',
);

export const COLLAB_WEBSOCKET_URL = stripTrailingSlash(
  import.meta.env.VITE_COLLAB_WS_URL ?? 'wss://devnoder-collab.ibrahimmamadoucoulibaly.workers.dev',
);

export const GITHUB_OAUTH_WORKER_URL = stripTrailingSlash(
  import.meta.env.VITE_GITHUB_OAUTH_WORKER ?? 'https://devnoder-oauth.ibrahimmamadoucoulibaly.workers.dev',
);
