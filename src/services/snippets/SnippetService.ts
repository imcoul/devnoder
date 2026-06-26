// SnippetService.ts — CRUD for code snippets, VS Code .code-snippets import
import Dexie, { Table } from 'dexie';

export interface Snippet {
  id?: number;
  name: string;
  prefix: string;          // trigger keyword (like VS Code snippet prefix)
  body: string;            // code body; $1, $2 = tab stops, $0 = final cursor
  description: string;
  language: string;        // '' = all languages
  tags: string[];
  usageCount: number;
  createdAt: number;
  updatedAt: number;
  source: 'user' | 'import' | 'builtin';
}

// VS Code .code-snippets file format
interface VSSnippet {
  prefix: string | string[];
  body: string | string[];
  description?: string;
  scope?: string;
}

class SnippetDB extends Dexie {
  snippets!: Table<Snippet>;
  constructor() {
    super('devnoder-snippets');
    this.version(1).stores({
      snippets: '++id, name, prefix, language, usageCount, updatedAt, *tags',
    });
  }
}

const db = new SnippetDB();

// ─── Built-in snippets (seeded on first run) ──────────────────────────────────
const BUILTINS: Omit<Snippet, 'id'>[] = [
  {
    name: 'React Functional Component',
    prefix: 'rfc',
    body: `import React from 'react';\n\ninterface $\{1:Props\} {}\n\nexport default function $\{2:ComponentName\}({}: $\{1:Props\}) {\n  return (\n    <div>\n      $0\n    </div>\n  );\n}`,
    description: 'React functional component with TypeScript props interface',
    language: 'tsx',
    tags: ['react', 'typescript', 'component'],
    usageCount: 0,
    createdAt: 0,
    updatedAt: 0,
    source: 'builtin',
  },
  {
    name: 'React useState',
    prefix: 'us',
    body: 'const [$\{1:state\}, set$\{1/(.*)/${1:/capitalize}/\}] = useState<$\{2:type\}>($\{3:initial\});',
    description: 'React useState hook with TypeScript generic',
    language: 'tsx',
    tags: ['react', 'hook', 'state'],
    usageCount: 0,
    createdAt: 0,
    updatedAt: 0,
    source: 'builtin',
  },
  {
    name: 'React useEffect',
    prefix: 'ue',
    body: 'useEffect(() => {\n  $0\n  return () => {\n    // cleanup\n  };\n}, [$1]);',
    description: 'React useEffect with cleanup function',
    language: 'tsx',
    tags: ['react', 'hook', 'effect'],
    usageCount: 0,
    createdAt: 0,
    updatedAt: 0,
    source: 'builtin',
  },
  {
    name: 'Async function',
    prefix: 'af',
    body: 'async function $\{1:name\}($\{2:params\}): Promise<$\{3:void\}> {\n  $0\n}',
    description: 'TypeScript async function',
    language: 'typescript',
    tags: ['async', 'typescript'],
    usageCount: 0,
    createdAt: 0,
    updatedAt: 0,
    source: 'builtin',
  },
  {
    name: 'Try-catch-finally',
    prefix: 'tcf',
    body: 'try {\n  $1\n} catch ($\{2:err\}) {\n  console.error($\{2:err\});\n} finally {\n  $0\n}',
    description: 'Try-catch-finally block',
    language: '',
    tags: ['error', 'async'],
    usageCount: 0,
    createdAt: 0,
    updatedAt: 0,
    source: 'builtin',
  },
  {
    name: 'Python def',
    prefix: 'def',
    body: 'def $\{1:function_name\}($\{2:args\}):\n    """$\{3:Docstring.\}"""\n    $0',
    description: 'Python function with docstring',
    language: 'python',
    tags: ['python', 'function'],
    usageCount: 0,
    createdAt: 0,
    updatedAt: 0,
    source: 'builtin',
  },
  {
    name: 'Cloudflare Worker fetch handler',
    prefix: 'cfw',
    body: `export default {\n  async fetch(request: Request, env: Env): Promise<Response> {\n    const url = new URL(request.url);\n    $0\n    return new Response('Not found', { status: 404 });\n  },\n};`,
    description: 'Cloudflare Worker fetch handler skeleton',
    language: 'typescript',
    tags: ['cloudflare', 'worker'],
    usageCount: 0,
    createdAt: 0,
    updatedAt: 0,
    source: 'builtin',
  },
  {
    name: 'CSS logical properties block',
    prefix: 'clp',
    body: `.$\{1:selector\} {\n  margin-block: $\{2:0\};\n  margin-inline: $\{3:0\};\n  padding-block: $\{4:0\};\n  padding-inline: $\{5:0\};\n  $0\n}`,
    description: 'CSS block using logical properties (RTL-safe)',
    language: 'css',
    tags: ['css', 'rtl', 'logical'],
    usageCount: 0,
    createdAt: 0,
    updatedAt: 0,
    source: 'builtin',
  },
];

export class SnippetService {
  private seeded = false;

  async init() {
    if (this.seeded) return;
    this.seeded = true;
    const count = await db.snippets.where('source').equals('builtin').count();
    if (count === 0) {
      const now = Date.now();
      await db.snippets.bulkAdd(BUILTINS.map(s => ({ ...s, createdAt: now, updatedAt: now })));
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async getAll(): Promise<Snippet[]> {
    await this.init();
    return db.snippets.orderBy('name').toArray();
  }

  async getById(id: number): Promise<Snippet | undefined> {
    return db.snippets.get(id);
  }

  async save(snippet: Snippet): Promise<number> {
    await this.init();
    const now = Date.now();
    if (snippet.id) {
      await db.snippets.put({ ...snippet, updatedAt: now });
      return snippet.id;
    }
    return db.snippets.add({ ...snippet, createdAt: now, updatedAt: now, source: 'user', usageCount: 0 }) as Promise<number>;
  }

  async delete(id: number) {
    await db.snippets.delete(id);
  }

  async incrementUsage(id: number) {
    const s = await db.snippets.get(id);
    if (s) await db.snippets.put({ ...s, usageCount: s.usageCount + 1 });
  }

  // ── Search ────────────────────────────────────────────────────────────────
  async search(query: string, language?: string): Promise<Snippet[]> {
    await this.init();
    const q = query.toLowerCase().trim();
    let collection = db.snippets.toCollection();

    const all = await collection.toArray();
    return all
      .filter(s => {
        const langMatch = !language || !s.language || s.language === language;
        if (!langMatch) return false;
        if (!q) return true;
        return (
          s.name.toLowerCase().includes(q) ||
          s.prefix.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some(t => t.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name));
  }

  /** Search by prefix exactly (for command palette inline expansion) */
  async findByPrefix(prefix: string, language?: string): Promise<Snippet | undefined> {
    await this.init();
    const all = await db.snippets.where('prefix').equals(prefix).toArray();
    return all.find(s => !s.language || !language || s.language === language) ?? all[0];
  }

  // ── VS Code .code-snippets import ─────────────────────────────────────────
  async importVSCode(json: string, scopeLanguage = ''): Promise<{ imported: number; skipped: number }> {
    let parsed: Record<string, VSSnippet>;
    try { parsed = JSON.parse(json); }
    catch { throw new Error('Invalid JSON in snippet file'); }

    let imported = 0, skipped = 0;
    const now = Date.now();

    for (const [name, def] of Object.entries(parsed)) {
      if (!def.prefix || !def.body) { skipped++; continue; }
      const prefix = Array.isArray(def.prefix) ? def.prefix[0] : def.prefix;
      const body = Array.isArray(def.body) ? def.body.join('\n') : def.body;
      const language = def.scope ? def.scope.split(',')[0].trim() : scopeLanguage;

      // Skip if prefix already exists for this language
      const existing = await this.findByPrefix(prefix, language || undefined);
      if (existing) { skipped++; continue; }

      await db.snippets.add({
        name,
        prefix,
        body,
        description: def.description ?? '',
        language,
        tags: [],
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
        source: 'import',
      });
      imported++;
    }

    return { imported, skipped };
  }

  /** Export all user snippets as VS Code .code-snippets JSON */
  async exportVSCode(): Promise<string> {
    const snippets = await db.snippets.where('source').notEqual('builtin').toArray();
    const out: Record<string, VSSnippet> = {};
    for (const s of snippets) {
      out[s.name] = {
        prefix: s.prefix,
        body: s.body.split('\n'),
        description: s.description,
        ...(s.language && { scope: s.language }),
      };
    }
    return JSON.stringify(out, null, 2);
  }

  // ── Expand snippet body (resolve $1 tab stops for plain text insert) ──────
  expandToText(body: string, tabValues: string[] = []): string {
    let result = body;
    tabValues.forEach((val, i) => {
      result = result.replace(new RegExp(`\\$\\{${i + 1}:[^}]*\\}`, 'g'), val);
      result = result.replace(new RegExp(`\\$${i + 1}`, 'g'), val);
    });
    // Remove remaining tab stops
    result = result.replace(/\$\{[^}]*\}/g, '').replace(/\$\d+/g, '');
    return result;
  }

  blank(): Omit<Snippet, 'id'> {
    return {
      name: '',
      prefix: '',
      body: '',
      description: '',
      language: '',
      tags: [],
      usageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: 'user',
    };
  }
}

export const snippetService = new SnippetService();
