import { LanguageSupport, StreamLanguage } from '@codemirror/language';

export type LangId =
  | 'javascript' | 'typescript' | 'jsx' | 'tsx'
  | 'html' | 'css' | 'json' | 'markdown'
  | 'python' | 'rust' | 'cpp' | 'c' | 'sql' | 'xml'
  | 'bash' | 'yaml' | 'toml' | 'dart' | 'php' | 'ruby'
  | 'plaintext';

export function extToLang(filename: string): LangId {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, LangId> = {
    js: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'tsx', jsx: 'jsx',
    html: 'html', htm: 'html', css: 'css',
    json: 'json', jsonc: 'json', md: 'markdown', mdx: 'markdown',
    py: 'python', rs: 'rust', cpp: 'cpp', cc: 'cpp', cxx: 'cpp',
    c: 'c', h: 'c', sql: 'sql', xml: 'xml', svg: 'xml',
    sh: 'bash', bash: 'bash', zsh: 'bash',
    yml: 'yaml', yaml: 'yaml', toml: 'toml',
    dart: 'dart', php: 'php', rb: 'ruby',
  };
  return map[ext] ?? 'plaintext';
}

const loaders: Record<LangId, () => Promise<LanguageSupport | StreamLanguage<unknown> | null>> = {
  javascript: () => import('@codemirror/lang-javascript').then(m => m.javascript()),
  typescript: () => import('@codemirror/lang-javascript').then(m => m.javascript({ typescript: true })),
  jsx:        () => import('@codemirror/lang-javascript').then(m => m.javascript({ jsx: true })),
  tsx:        () => import('@codemirror/lang-javascript').then(m => m.javascript({ jsx: true, typescript: true })),
  html:       () => import('@codemirror/lang-html').then(m => m.html()),
  css:        () => import('@codemirror/lang-css').then(m => m.css()),
  json:       () => import('@codemirror/lang-json').then(m => m.json()),
  markdown:   () => import('@codemirror/lang-markdown').then(m => m.markdown()),
  python:     () => import('@codemirror/lang-python').then(m => m.python()),
  rust:       () => import('@codemirror/lang-rust').then(m => m.rust()),
  cpp:        () => import('@codemirror/lang-cpp').then(m => m.cpp()),
  c:          () => import('@codemirror/lang-cpp').then(m => m.cpp()),
  sql:        () => import('@codemirror/lang-sql').then(m => m.sql()),
  xml:        () => import('@codemirror/lang-xml').then(m => m.xml()),

  // Legacy modes — fixed: no require(), pure dynamic imports only
  bash: () => Promise.all([
    import('@codemirror/language'),
    import('@codemirror/legacy-modes/mode/shell'),
  ]).then(([{ StreamLanguage }, { shell }]) => StreamLanguage.define(shell)),

  yaml: () => Promise.all([
    import('@codemirror/language'),
    import('@codemirror/legacy-modes/mode/yaml'),
  ]).then(([{ StreamLanguage }, { yaml }]) => StreamLanguage.define(yaml)),

  toml: () => Promise.all([
    import('@codemirror/language'),
    import('@codemirror/legacy-modes/mode/toml'),
  ]).then(([{ StreamLanguage }, { toml }]) => StreamLanguage.define(toml)),

  dart: () => Promise.all([
    import('@codemirror/language'),
    import('@codemirror/legacy-modes/mode/clike'),
  ]).then(([{ StreamLanguage }, modes]) => StreamLanguage.define((modes as any).dart)),

  php: () => Promise.all([
    import('@codemirror/language'),
    import('@codemirror/legacy-modes/mode/clike'),
  ]).then(([{ StreamLanguage }, modes]) => StreamLanguage.define((modes as any).php)),

  ruby: () => Promise.all([
    import('@codemirror/language'),
    import('@codemirror/legacy-modes/mode/ruby'),
  ]).then(([{ StreamLanguage }, { ruby }]) => StreamLanguage.define(ruby)),

  plaintext: () => Promise.resolve(null),
};

const cache = new Map<LangId, LanguageSupport | null>();

export async function loadLanguage(id: LangId): Promise<LanguageSupport | StreamLanguage<unknown> | null> {
  if (cache.has(id)) return cache.get(id)!;
  try {
    const lang = await loaders[id]?.() ?? null;
    cache.set(id, lang);
    return lang;
  } catch {
    return null;
  }
}
