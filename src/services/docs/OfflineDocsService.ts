// OfflineDocsService.ts — offline documentation browser using Cache API
export interface DocSource {
  id: string;
  name: string;
  icon: string;
  baseUrl: string;
  searchUrl: string;
  offlinePaths: string[];
  cached: boolean;
  cacheSize?: number; // bytes
}

export interface DocPage {
  sourceId: string;
  title: string;
  url: string;
  excerpt: string;
  content?: string;
}

const CACHE_PREFIX = 'devnoder-docs-';

const SOURCES: DocSource[] = [
  {
    id: 'mdn',
    name: 'MDN Web Docs',
    icon: '🌐',
    baseUrl: 'https://developer.mozilla.org',
    searchUrl: 'https://developer.mozilla.org/api/v1/search?q={query}&locale=en-US',
    offlinePaths: ['/en-US/docs/Web/JavaScript/Reference', '/en-US/docs/Web/CSS/Reference', '/en-US/docs/Web/HTML/Reference'],
    cached: false,
  },
  {
    id: 'react',
    name: 'React Docs',
    icon: '⚛️',
    baseUrl: 'https://react.dev',
    searchUrl: 'https://react.dev/search?q={query}',
    offlinePaths: ['/learn', '/reference/react'],
    cached: false,
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare Workers Docs',
    icon: '☁️',
    baseUrl: 'https://developers.cloudflare.com',
    searchUrl: 'https://developers.cloudflare.com/search/?q={query}',
    offlinePaths: ['/workers', '/pages', '/d1', '/r2'],
    cached: false,
  },
  {
    id: 'typescript',
    name: 'TypeScript Handbook',
    icon: '🔷',
    baseUrl: 'https://www.typescriptlang.org',
    searchUrl: 'https://www.typescriptlang.org/search#q={query}',
    offlinePaths: ['/docs/handbook'],
    cached: false,
  },
  {
    id: 'python',
    name: 'Python Docs',
    icon: '🐍',
    baseUrl: 'https://docs.python.org/3',
    searchUrl: 'https://docs.python.org/3/search.html?q={query}',
    offlinePaths: ['/library', '/tutorial'],
    cached: false,
  },
];

export class OfflineDocsService {
  private sources: DocSource[] = SOURCES;

  async getSources(): Promise<DocSource[]> {
    // Check cache status for each source
    for (const src of this.sources) {
      const cache = await caches.open(`${CACHE_PREFIX}${src.id}`);
      const keys = await cache.keys();
      src.cached = keys.length > 0;
      if (src.cached) {
        // Rough size estimate
        let totalSize = 0;
        for (const req of keys.slice(0, 20)) {
          const res = await cache.match(req);
          if (res) {
            const buf = await res.arrayBuffer();
            totalSize += buf.byteLength;
          }
        }
        src.cacheSize = totalSize;
      }
    }
    return this.sources;
  }

  getSource(id: string): DocSource | undefined {
    return this.sources.find(s => s.id === id);
  }

  /** Cache a doc source's key pages for offline use */
  async cacheSource(
    sourceId: string,
    onProgress?: (url: string, done: number, total: number) => void,
  ): Promise<{ cached: number; failed: number }> {
    const src = this.getSource(sourceId);
    if (!src) throw new Error(`Unknown source: ${sourceId}`);

    const cache = await caches.open(`${CACHE_PREFIX}${sourceId}`);
    let cached = 0, failed = 0;
    const total = src.offlinePaths.length;

    for (let i = 0; i < total; i++) {
      const url = `${src.baseUrl}${src.offlinePaths[i]}`;
      onProgress?.(url, i, total);
      try {
        await cache.add(url);
        cached++;
      } catch {
        failed++;
      }
    }

    src.cached = true;
    return { cached, failed };
  }

  /** Clear cached docs for a source */
  async clearSource(sourceId: string): Promise<void> {
    await caches.delete(`${CACHE_PREFIX}${sourceId}`);
    const src = this.getSource(sourceId);
    if (src) { src.cached = false; src.cacheSize = 0; }
  }

  /** Search within a source (online) */
  async search(sourceId: string, query: string): Promise<DocPage[]> {
    const src = this.getSource(sourceId);
    if (!src || !query.trim()) return [];

    const url = src.searchUrl.replace('{query}', encodeURIComponent(query));

    try {
      // Try cache first
      const cache = await caches.open(`${CACHE_PREFIX}${sourceId}`);
      let response = await cache.match(url);
      if (!response) response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response?.ok) return [];

      // MDN returns structured JSON; others return HTML
      if (sourceId === 'mdn') {
        const data = await response.json();
        return (data.documents ?? []).slice(0, 10).map((doc: any) => ({
          sourceId,
          title: doc.title,
          url: `${src.baseUrl}${doc.mdn_url}`,
          excerpt: doc.summary ?? '',
        }));
      }

      return [{
        sourceId,
        title: `Search: ${query}`,
        url,
        excerpt: `Open ${src.name} search results`,
      }];
    } catch {
      return [];
    }
  }

  /** Fetch a doc page content (cache-first) */
  async fetchPage(url: string): Promise<string> {
    for (const src of this.sources) {
      if (url.startsWith(src.baseUrl)) {
        const cache = await caches.open(`${CACHE_PREFIX}${src.id}`);
        const cached = await cache.match(url);
        if (cached) return cached.text();
        break;
      }
    }
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      return res.text();
    } catch {
      return '<p>Page not available offline.</p>';
    }
  }

  formatCacheSize(bytes?: number): string {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

export const offlineDocsService = new OfflineDocsService();
