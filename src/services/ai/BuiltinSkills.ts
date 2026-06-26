// BuiltinSkills.ts — 7 built-in skills shipped with DevNoder
import { Skill, skillStore } from './SkillStore';

const BUILTINS: Skill[] = [
  {
    id: 'builtin-code-context',
    name: 'Code Context',
    description: 'Always inject the active file and its language into every AI request',
    icon: '💻',
    trigger: 'always',
    systemPromptPrefix: '',
    systemPromptSuffix: '',
    contextInjectors: [{ type: 'active-file' }],
    author: 'Srvel',
    source: 'builtin',
    enabled: true,
    createdAt: 0,
  },
  {
    id: 'builtin-git-aware',
    name: 'Git-Aware Commits',
    description: 'Injects the full staged diff before generating commit messages',
    icon: '🔀',
    trigger: 'agent',
    triggerValue: 'commit',
    systemPromptPrefix: 'You are generating a conventional commit message. Study the diff carefully before responding.',
    systemPromptSuffix: 'Format: type(scope): subject — imperative mood, max 72 chars, no period.',
    contextInjectors: [{ type: 'git-status' }],
    author: 'Srvel',
    source: 'builtin',
    enabled: true,
    createdAt: 0,
  },
  {
    id: 'builtin-mobile-css',
    name: 'Mobile CSS (RTL-safe)',
    description: 'Reminds the model to use CSS logical properties — never margin-left, always margin-inline-start',
    icon: '📱',
    trigger: 'filetype',
    triggerValue: 'css',
    systemPromptPrefix: 'CRITICAL CSS RULES for this project:\n- Use CSS logical properties exclusively\n- margin-inline-start NOT margin-left\n- padding-block NOT padding-top/padding-bottom\n- inset-block-start NOT top (in positioned elements)\n- block-size / inline-size NOT height / width\n- border-inline-end NOT border-right\nThis is required for RTL (Arabic) support.',
    systemPromptSuffix: '',
    contextInjectors: [],
    author: 'Srvel',
    source: 'builtin',
    enabled: true,
    createdAt: 0,
  },
  {
    id: 'builtin-srvel-brand',
    name: 'Srvel Brand Tokens',
    description: 'Injects Srvel design system tokens when building UI components',
    icon: '🌊',
    trigger: 'keyword',
    triggerValue: 'component',
    systemPromptPrefix: `Srvel Design System — use these CSS variables:
--color-canvas: #0D1F1E (app background)
--color-surface: #162A28 (cards, panels)
--color-surface-hover: #1e3a37
--color-border: #2a3f3d
--color-text: #f0f6fc
--color-text-muted: #8b9ea0
--color-turquoise: #40E0D0 (primary accent)
--color-yellow: #FFFF80 (secondary accent)
--color-purple: #800080 (tertiary accent)
--color-error: #ef4444
--color-success: #22c55e
--font-display: 'Comfortaa', sans-serif
--font-body: 'Quicksand', sans-serif
--font-code: 'JetBrains Mono', monospace
--radius: 0.375rem
--nav-height: 3.5rem
Always use CSS logical properties. Support RTL (Arabic) from the start.`,
    systemPromptSuffix: '',
    contextInjectors: [],
    author: 'Srvel',
    source: 'builtin',
    enabled: true,
    createdAt: 0,
  },
  {
    id: 'builtin-offline-first',
    name: 'Offline-First API',
    description: 'Reminds model to handle offline / network-error cases in all API code',
    icon: '📡',
    trigger: 'keyword',
    triggerValue: 'api',
    systemPromptPrefix: `This project is offline-first. For all API / network code:
- Always wrap fetch() in try/catch with offline fallback
- Use SyncQueue for operations that need to persist offline
- Check navigator.onLine before critical network calls
- Cache responses in IndexedDB (Dexie) for offline access
- Show offline indicator to user when network unavailable
- Queue failed requests and retry when online event fires`,
    systemPromptSuffix: '',
    contextInjectors: [],
    author: 'Srvel',
    source: 'builtin',
    enabled: true,
    createdAt: 0,
  },
  {
    id: 'builtin-dart-flutter',
    name: 'Flutter Best Practices',
    description: 'Injects Flutter widget best practices and null-safety patterns for .dart files',
    icon: '🐦',
    trigger: 'filetype',
    triggerValue: 'dart',
    systemPromptPrefix: `Flutter / Dart best practices for this project:
- Use const constructors wherever possible
- Prefer StatelessWidget; use StatefulWidget only when local state needed
- Use super.key pattern: const MyWidget({super.key})
- Use null-safety: avoid ! operator, prefer ?. and ?? 
- Prefer named parameters for readability
- Extract large build() methods into private _build* methods
- Use Material 3 (useMaterial3: true in ThemeData)
- Prefer ColorScheme over direct color values
- Use adaptive widgets (AdaptiveListTile, etc.) for cross-platform`,
    systemPromptSuffix: '',
    contextInjectors: [],
    author: 'Srvel',
    source: 'builtin',
    enabled: true,
    createdAt: 0,
  },
  {
    id: 'builtin-cloudflare-worker',
    name: 'Cloudflare Worker Patterns',
    description: 'Injects Cloudflare Worker / D1 / R2 / Durable Objects patterns for TypeScript files',
    icon: '☁️',
    trigger: 'keyword',
    triggerValue: 'worker',
    systemPromptPrefix: `Cloudflare Workers platform for this project:
- Use export default { fetch(req, env, ctx) } pattern
- D1: env.DB.prepare(sql).bind(...args).run() / .all() / .first()
- R2: env.STORAGE.get(key) / .put(key, body) / .delete(key)
- KV: env.KV.get(key) / .put(key, value, { expirationTtl })
- Durable Objects: env.MY_DO.idFromName(id) then .get(id).fetch(req)
- Always return new Response() — never throw unhandled
- Use waitUntil(ctx, promise) for non-blocking background work
- wrangler.toml: compatibility_date = "2024-09-23"
- Free tier limits: 100k req/day Workers, 100k reads/day D1`,
    systemPromptSuffix: '',
    contextInjectors: [],
    author: 'Srvel',
    source: 'builtin',
    enabled: true,
    createdAt: 0,
  },
];

export async function seedBuiltinSkills(): Promise<void> {
  for (const skill of BUILTINS) {
    const existing = await skillStore.getBySource('builtin');
    const found = existing.find(s => s.id === skill.id);
    if (!found) await skillStore.save(skill);
  }
}

export { BUILTINS };
