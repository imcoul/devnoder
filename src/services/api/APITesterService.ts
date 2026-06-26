// APITesterService.ts — request engine, collections, cURL import/export
import Dexie, { Table } from 'dexie';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface RequestHeader { key: string; value: string; enabled: boolean; }
export interface RequestParam  { key: string; value: string; enabled: boolean; }

export interface APIRequest {
  id?: number;
  collectionId?: number;
  name: string;
  method: HttpMethod;
  url: string;
  headers: RequestHeader[];
  params: RequestParam[];
  body: string;
  bodyType: 'none' | 'json' | 'form' | 'text' | 'xml';
  createdAt: number;
  updatedAt: number;
}

export interface APIResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number;
  size: number;
}

export interface APICollection {
  id?: number;
  name: string;
  description: string;
  createdAt: number;
}

export interface HistoryEntry {
  id?: number;
  request: APIRequest;
  response: APIResponse;
  timestamp: number;
}

class APITesterDB extends Dexie {
  requests!: Table<APIRequest>;
  collections!: Table<APICollection>;
  history!: Table<HistoryEntry>;

  constructor() {
    super('devnoder-api-tester');
    this.version(1).stores({
      requests: '++id, collectionId, name, method, updatedAt',
      collections: '++id, name',
      history: '++id, timestamp',
    });
  }
}

const db = new APITesterDB();

export class APITesterService {
  // ── Execute ──────────────────────────────────────────────────────────────
  async send(req: APIRequest): Promise<APIResponse> {
    const start = performance.now();

    // Build URL with query params
    let url = req.url;
    const activeParams = req.params.filter(p => p.enabled && p.key);
    if (activeParams.length) {
      const qs = new URLSearchParams(activeParams.map(p => [p.key, p.value]));
      url += (url.includes('?') ? '&' : '?') + qs.toString();
    }

    // Build headers
    const headers: Record<string, string> = {};
    req.headers.filter(h => h.enabled && h.key).forEach(h => { headers[h.key] = h.value; });
    if (req.bodyType === 'json' && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    if (req.bodyType === 'form') headers['Content-Type'] = 'application/x-www-form-urlencoded';

    const init: RequestInit = { method: req.method, headers };
    if (req.body && req.bodyType !== 'none' && req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = req.body;
    }

    try {
      const res = await fetch(url, init);
      const duration = Math.round(performance.now() - start);
      const body = await res.text();
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { resHeaders[k] = v; });

      const response: APIResponse = {
        status: res.status,
        statusText: res.statusText,
        headers: resHeaders,
        body,
        duration,
        size: new TextEncoder().encode(body).length,
      };

      // Save to history
      await db.history.add({ request: req, response, timestamp: Date.now() });
      if (await db.history.count() > 200) {
        const oldest = await db.history.orderBy('timestamp').first();
        if (oldest?.id) await db.history.delete(oldest.id);
      }

      return response;
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      return { status: 0, statusText: err.message, headers: {}, body: '', duration, size: 0 };
    }
  }

  // ── Collections ───────────────────────────────────────────────────────────
  async getCollections(): Promise<APICollection[]> {
    return db.collections.orderBy('name').toArray();
  }
  async addCollection(name: string, description = ''): Promise<number> {
    return db.collections.add({ name, description, createdAt: Date.now() }) as Promise<number>;
  }
  async deleteCollection(id: number) {
    await db.requests.where('collectionId').equals(id).delete();
    await db.collections.delete(id);
  }

  // ── Requests ──────────────────────────────────────────────────────────────
  async getRequests(collectionId?: number): Promise<APIRequest[]> {
    if (collectionId !== undefined) return db.requests.where('collectionId').equals(collectionId).toArray();
    return db.requests.orderBy('updatedAt').reverse().toArray();
  }
  async saveRequest(req: APIRequest): Promise<number> {
    if (req.id) { await db.requests.put({ ...req, updatedAt: Date.now() }); return req.id; }
    return db.requests.add({ ...req, createdAt: Date.now(), updatedAt: Date.now() }) as Promise<number>;
  }
  async deleteRequest(id: number) { await db.requests.delete(id); }

  // ── History ───────────────────────────────────────────────────────────────
  async getHistory(limit = 50): Promise<HistoryEntry[]> {
    return db.history.orderBy('timestamp').reverse().limit(limit).toArray();
  }
  async clearHistory() { await db.history.clear(); }

  // ── cURL ──────────────────────────────────────────────────────────────────
  toCurl(req: APIRequest): string {
    const parts = [`curl -X ${req.method}`];
    req.headers.filter(h => h.enabled && h.key).forEach(h => {
      parts.push(`  -H '${h.key}: ${h.value}'`);
    });
    if (req.body && req.bodyType !== 'none') parts.push(`  -d '${req.body.replace(/'/g, "\\'")}'`);
    parts.push(`  '${req.url}'`);
    return parts.join(' \\\n');
  }

  fromCurl(curl: string): Partial<APIRequest> {
    const req: Partial<APIRequest> = { headers: [], params: [], bodyType: 'none', body: '' };
    const methodMatch = curl.match(/-X\s+(\w+)/);
    req.method = (methodMatch?.[1] as HttpMethod) ?? 'GET';
    const urlMatch = curl.match(/'([^']+)'\s*$/m) ?? curl.match(/"([^"]+)"\s*$/m);
    req.url = urlMatch?.[1] ?? '';
    const headers: RequestHeader[] = [];
    for (const m of curl.matchAll(/-H\s+'([^:]+):\s*([^']+)'/g)) {
      headers.push({ key: m[1].trim(), value: m[2].trim(), enabled: true });
    }
    req.headers = headers;
    const bodyMatch = curl.match(/-d\s+'([^']+)'/);
    if (bodyMatch) { req.body = bodyMatch[1]; req.bodyType = 'json'; }
    return req;
  }

  // ── Blank request ─────────────────────────────────────────────────────────
  blank(): APIRequest {
    return {
      name: 'Untitled',
      method: 'GET',
      url: '',
      headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
      params: [],
      body: '',
      bodyType: 'none',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
}

export const apiTesterService = new APITesterService();
