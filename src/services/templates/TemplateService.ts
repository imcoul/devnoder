// TemplateService.ts — 7 starter templates, offline, creates files via lightning-fs
import Dexie, { Table } from 'dexie';

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  tags: string[];
  files: TemplateFile[];
  commands: string[];   // setup commands to show user (run locally)
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export interface TemplateFile {
  path: string;
  content: string;
}

// ─── Template definitions ────────────────────────────────────────────────────
const TEMPLATES: Template[] = [

  // 1. React + Vite + TypeScript
  {
    id: 'react-vite-ts',
    name: 'React + Vite + TypeScript',
    description: 'Modern React app with Vite, TypeScript, and CSS modules',
    icon: '⚛️',
    tags: ['react', 'vite', 'typescript', 'web'],
    commands: ['npm install', 'npm run dev'],
    dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
    devDependencies: {
      '@types/react': '^18.3.0', '@types/react-dom': '^18.3.0',
      '@vitejs/plugin-react': '^4.3.0', 'typescript': '^5.5.0', 'vite': '^5.4.0',
    },
    files: [
      { path: 'index.html', content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>` },
      { path: 'vite.config.ts', content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()] });` },
      { path: 'tsconfig.json', content: JSON.stringify({
        compilerOptions: {
          target: 'ES2020', useDefineForClassFields: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext', skipLibCheck: true, moduleResolution: 'bundler',
          allowImportingTsExtensions: true, isolatedModules: true,
          moduleDetection: 'force', noEmit: true, jsx: 'react-jsx',
          strict: true,
        },
        include: ['src'],
      }, null, 2) },
      { path: 'src/main.tsx', content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);` },
      { path: 'src/App.tsx', content: `import React, { useState } from 'react';
import styles from './App.module.css';

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <main className={styles.app}>
      <h1>Hello DevNoder 🚀</h1>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
    </main>
  );
}` },
      { path: 'src/App.module.css', content: `.app { font-family: sans-serif; text-align: center; padding: 2rem; }
button { padding: 0.5rem 1.5rem; font-size: 1rem; cursor: pointer; }` },
      { path: 'src/index.css', content: `* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0d1117; color: #f0f6fc; }` },
      { path: 'src/vite-env.d.ts', content: `/// <reference types="vite/client" />` },
      { path: 'package.json', content: JSON.stringify({
        name: 'my-app', private: true, version: '0.0.0', type: 'module',
        scripts: { dev: 'vite', build: 'tsc -b && vite build', preview: 'vite preview' },
        dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
        devDependencies: {
          '@types/react': '^18.3.0', '@types/react-dom': '^18.3.0',
          '@vitejs/plugin-react': '^4.3.0', typescript: '^5.5.0', vite: '^5.4.0',
        },
      }, null, 2) },
      { path: '.gitignore', content: `node_modules\ndist\n.env\n*.local` },
      { path: 'README.md', content: `# My App\n\nBuilt with DevNoder.\n\n## Start\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`` },
    ],
  },

  // 2. Next.js 15
  {
    id: 'nextjs-15',
    name: 'Next.js 15',
    description: 'Full-stack React with App Router, TypeScript, and Tailwind CSS',
    icon: '▲',
    tags: ['next', 'react', 'typescript', 'fullstack', 'tailwind'],
    commands: ['npm install', 'npm run dev'],
    dependencies: { next: '^15.0.0', react: '^18.3.1', 'react-dom': '^18.3.1' },
    devDependencies: {
      '@types/node': '^20', '@types/react': '^18', '@types/react-dom': '^18',
      typescript: '^5', tailwindcss: '^3', postcss: '^8', autoprefixer: '^10',
    },
    files: [
      { path: 'package.json', content: JSON.stringify({
        name: 'my-next-app', version: '0.1.0', private: true,
        scripts: { dev: 'next dev', build: 'next build', start: 'next start', lint: 'next lint' },
        dependencies: { next: '^15.0.0', react: '^18.3.1', 'react-dom': '^18.3.1' },
        devDependencies: {
          '@types/node': '^20', '@types/react': '^18', '@types/react-dom': '^18',
          typescript: '^5', tailwindcss: '^3', postcss: '^8', autoprefixer: '^10',
        },
      }, null, 2) },
      { path: 'next.config.ts', content: `import type { NextConfig } from 'next';
const nextConfig: NextConfig = {};
export default nextConfig;` },
      { path: 'tsconfig.json', content: JSON.stringify({
        compilerOptions: {
          target: 'ES2017', lib: ['dom', 'dom.iterable', 'esnext'],
          allowJs: true, skipLibCheck: true, strict: true, noEmit: true,
          esModuleInterop: true, module: 'esnext', moduleResolution: 'bundler',
          resolveJsonModule: true, isolatedModules: true, jsx: 'preserve',
          incremental: true, plugins: [{ name: 'next' }],
          paths: { '@/*': ['./src/*'] },
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
        exclude: ['node_modules'],
      }, null, 2) },
      { path: 'tailwind.config.ts', content: `import type { Config } from 'tailwindcss';
const config: Config = { content: ['./src/**/*.{ts,tsx}'], theme: { extend: {} }, plugins: [] };
export default config;` },
      { path: 'postcss.config.mjs', content: `const config = { plugins: { tailwindcss: {}, autoprefixer: {} } };
export default config;` },
      { path: 'src/app/layout.tsx', content: `import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'My Next App', description: 'Built with DevNoder' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}` },
      { path: 'src/app/page.tsx', content: `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Hello Next.js 15 🚀</h1>
      <p className="mt-4 text-gray-400">Built with DevNoder</p>
    </main>
  );
}` },
      { path: 'src/app/globals.css', content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;` },
      { path: '.gitignore', content: `.next\nnode_modules\n.env*.local\nout` },
    ],
  },

  // 3. Flutter (Dart pubspec + main)
  {
    id: 'flutter',
    name: 'Flutter App',
    description: 'Flutter starter with Material 3, Dart null safety',
    icon: '🐦',
    tags: ['flutter', 'dart', 'mobile', 'cross-platform'],
    commands: ['flutter pub get', 'flutter run'],
    dependencies: {},
    devDependencies: {},
    files: [
      { path: 'pubspec.yaml', content: `name: my_flutter_app
description: A Flutter app built with DevNoder.
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.8

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0

flutter:
  uses-material-design: true
` },
      { path: 'lib/main.dart', content: `import 'package:flutter/material.dart';

void main() => runApp(const MyApp());

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'My Flutter App',
      theme: ThemeData(colorSchemeSeed: Colors.teal, useMaterial3: true),
      home: const HomePage(),
    );
  }
}

class HomePage extends StatefulWidget {
  const HomePage({super.key});
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _count = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('DevNoder Flutter')),
      body: Center(
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Text('You pressed the button:'),
          Text('\$_count', style: Theme.of(context).textTheme.displayMedium),
        ]),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => setState(() => _count++),
        child: const Icon(Icons.add),
      ),
    );
  }
}
` },
      { path: 'analysis_options.yaml', content: `include: package:flutter_lints/flutter.yaml` },
      { path: '.gitignore', content: `.dart_tool/\nbuild/\npubspec.lock` },
      { path: 'README.md', content: `# My Flutter App\n\nBuilt with DevNoder.\n\n\`\`\`bash\nflutter pub get\nflutter run\n\`\`\`` },
    ],
  },

  // 4. Node Express API
  {
    id: 'node-express',
    name: 'Node.js + Express API',
    description: 'REST API with Express, TypeScript, and zod validation',
    icon: '🟢',
    tags: ['node', 'express', 'api', 'typescript', 'backend'],
    commands: ['npm install', 'npm run dev'],
    dependencies: { express: '^4.21.0', zod: '^3.23.0' },
    devDependencies: {
      '@types/express': '^4.17.21', '@types/node': '^20',
      typescript: '^5', 'ts-node': '^10', nodemon: '^3',
    },
    files: [
      { path: 'package.json', content: JSON.stringify({
        name: 'my-api', version: '1.0.0', type: 'commonjs',
        scripts: { dev: 'nodemon --exec ts-node src/index.ts', build: 'tsc', start: 'node dist/index.js' },
        dependencies: { express: '^4.21.0', zod: '^3.23.0' },
        devDependencies: {
          '@types/express': '^4.17.21', '@types/node': '^20',
          typescript: '^5', 'ts-node': '^10', nodemon: '^3',
        },
      }, null, 2) },
      { path: 'tsconfig.json', content: JSON.stringify({
        compilerOptions: {
          target: 'ES2020', module: 'commonjs', lib: ['ES2020'],
          outDir: 'dist', rootDir: 'src', strict: true, esModuleInterop: true, skipLibCheck: true,
        },
        include: ['src'],
      }, null, 2) },
      { path: 'src/index.ts', content: `import express from 'express';
import { router } from './routes/items';

const app = express();
app.use(express.json());
app.use('/api/items', router);
app.get('/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(\`Server running on http://localhost:\${PORT}\`));
` },
      { path: 'src/routes/items.ts', content: `import { Router } from 'express';
import { z } from 'zod';

export const router = Router();

const ItemSchema = z.object({ name: z.string().min(1), value: z.number() });
const items: Array<{ id: number; name: string; value: number }> = [];
let nextId = 1;

router.get('/', (_, res) => res.json(items));
router.post('/', (req, res) => {
  const result = ItemSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json(result.error);
  const item = { id: nextId++, ...result.data };
  items.push(item);
  res.status(201).json(item);
});
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  items.splice(idx, 1);
  res.status(204).end();
});
` },
      { path: '.gitignore', content: `node_modules\ndist\n.env` },
    ],
  },

  // 5. Python FastAPI
  {
    id: 'python-fastapi',
    name: 'Python FastAPI',
    description: 'Modern async API with FastAPI, Pydantic v2, and uvicorn',
    icon: '🐍',
    tags: ['python', 'fastapi', 'api', 'async', 'backend'],
    commands: ['pip install fastapi uvicorn pydantic', 'uvicorn main:app --reload'],
    dependencies: {},
    devDependencies: {},
    files: [
      { path: 'main.py', content: `from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

app = FastAPI(title="My API", version="1.0.0")

class Item(BaseModel):
    name: str
    value: float

class StoredItem(Item):
    id: int

items: List[StoredItem] = []
_next_id = 1

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/items", response_model=List[StoredItem])
def list_items():
    return items

@app.post("/items", response_model=StoredItem, status_code=201)
def create_item(item: Item):
    global _next_id
    stored = StoredItem(id=_next_id, **item.model_dump())
    _next_id += 1
    items.append(stored)
    return stored

@app.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int):
    for i, item in enumerate(items):
        if item.id == item_id:
            items.pop(i)
            return
    raise HTTPException(status_code=404, detail="Item not found")
` },
      { path: 'requirements.txt', content: `fastapi>=0.115.0\nuvicorn[standard]>=0.30.0\npydantic>=2.0.0\n` },
      { path: '.gitignore', content: `__pycache__/\n*.pyc\n.venv/\n.env` },
      { path: 'README.md', content: `# My FastAPI App\n\n\`\`\`bash\npip install -r requirements.txt\nuvicorn main:app --reload\n\`\`\`\n\nDocs at http://localhost:8000/docs` },
    ],
  },

  // 6. Vanilla HTML/CSS/JS
  {
    id: 'vanilla',
    name: 'Vanilla HTML / CSS / JS',
    description: 'Zero-dependency starter, no build step needed',
    icon: '🌐',
    tags: ['html', 'css', 'javascript', 'vanilla', 'beginner'],
    commands: ['open index.html', '# or: npx serve .'],
    dependencies: {},
    devDependencies: {},
    files: [
      { path: 'index.html', content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My App</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main class="container">
    <h1>Hello World 🌍</h1>
    <p id="msg">Click the button below.</p>
    <button id="btn">Click me</button>
  </main>
  <script src="app.js"></script>
</body>
</html>` },
      { path: 'style.css', content: `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #0d1117; color: #f0f6fc; min-height: 100vh; display: grid; place-items: center; }
.container { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
h1 { font-size: clamp(1.5rem, 5vw, 3rem); }
button { padding: 0.6rem 1.6rem; font-size: 1rem; border: none; border-radius: 0.5rem; background: #40E0D0; color: #0d1f1e; font-weight: 700; cursor: pointer; }
button:hover { opacity: 0.85; }` },
      { path: 'app.js', content: `const btn = document.getElementById('btn');
const msg = document.getElementById('msg');
let count = 0;

btn.addEventListener('click', () => {
  count++;
  msg.textContent = \`You clicked \${count} time\${count === 1 ? '' : 's'}!\`;
});` },
      { path: '.gitignore', content: `.DS_Store\nThumbs.db` },
    ],
  },

  // 7. Srvel Starter (DevNoder brand)
  {
    id: 'srvel-starter',
    name: 'Srvel Starter',
    description: 'DevNoder-branded PWA starter with Srvel theme, CSS tokens, and i18n scaffold',
    icon: '🌊',
    tags: ['srvel', 'pwa', 'react', 'vite', 'typescript', 'i18n'],
    commands: ['npm install', 'npm run dev'],
    dependencies: {
      react: '^18.3.1', 'react-dom': '^18.3.1',
      i18next: '^23.15.0', 'react-i18next': '^15.1.0',
      'i18next-browser-languagedetector': '^8.0.0',
    },
    devDependencies: {
      '@types/react': '^18.3.0', '@types/react-dom': '^18.3.0',
      '@vitejs/plugin-react': '^4.3.0', typescript: '^5.5.0', vite: '^5.4.0',
      'vite-plugin-pwa': '^0.20.0',
    },
    files: [
      { path: 'src/styles/tokens.css', content: `:root {
  --color-turquoise: #40E0D0;
  --color-yellow:    #FFFF80;
  --color-purple:    #800080;
  --color-canvas:    #0D1F1E;
  --color-surface:   #162A28;
  --color-border:    #2a3f3d;
  --color-text:      #f0f6fc;
  --color-text-muted: #8b9ea0;
  --font-display: 'Comfortaa', sans-serif;
  --font-body:    'Quicksand', sans-serif;
  --font-code:    'JetBrains Mono', monospace;
}` },
      { path: 'src/main.tsx', content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import App from './App';
import './i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);` },
      { path: 'src/styles/base.css', content: `@import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;700&family=Quicksand:wght@400;600&family=JetBrains+Mono&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--font-body); background: var(--color-canvas); color: var(--color-text); }` },
      { path: 'src/App.tsx', content: `import React from 'react';
import { useTranslation } from 'react-i18next';

export default function App() {
  const { t, i18n } = useTranslation();
  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-turquoise)', fontSize: '2rem' }}>
        {t('welcome')}
      </h1>
      <p style={{ marginTop: '1rem', color: 'var(--color-text-muted)' }}>Serve • Grow • Lead</p>
      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
        {['en', 'fr', 'ar'].map(lang => (
          <button key={lang} onClick={() => i18n.changeLanguage(lang)}
            style={{ padding: '0.3rem 0.7rem', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.25rem', cursor: 'pointer' }}>
            {lang.toUpperCase()}
          </button>
        ))}
      </div>
    </main>
  );
}` },
      { path: 'src/i18n/index.ts', content: `import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import fr from './locales/fr.json';
import ar from './locales/ar.json';

i18n.use(LanguageDetector).use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr }, ar: { translation: ar } },
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
export default i18n;` },
      { path: 'src/i18n/locales/en.json', content: JSON.stringify({ welcome: 'Welcome to Srvel Starter' }, null, 2) },
      { path: 'src/i18n/locales/fr.json', content: JSON.stringify({ welcome: 'Bienvenue sur Srvel Starter' }, null, 2) },
      { path: 'src/i18n/locales/ar.json', content: JSON.stringify({ welcome: 'مرحباً بك في Srvel Starter' }, null, 2) },
      { path: 'public/manifest.json', content: JSON.stringify({
        name: 'My Srvel App', short_name: 'SrvelApp',
        start_url: '/', display: 'standalone',
        background_color: '#0D1F1E', theme_color: '#40E0D0',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      }, null, 2) },
      { path: 'index.html', content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="manifest" href="/manifest.json" />
  <title>Srvel App</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>` },
      { path: 'package.json', content: JSON.stringify({
        name: 'srvel-starter', private: true, version: '0.1.0', type: 'module',
        scripts: { dev: 'vite', build: 'tsc -b && vite build', preview: 'vite preview' },
        dependencies: {
          react: '^18.3.1', 'react-dom': '^18.3.1',
          i18next: '^23.15.0', 'react-i18next': '^15.1.0',
          'i18next-browser-languagedetector': '^8.0.0',
        },
        devDependencies: {
          '@types/react': '^18.3.0', '@types/react-dom': '^18.3.0',
          '@vitejs/plugin-react': '^4.3.0', typescript: '^5.5.0', vite: '^5.4.0',
        },
      }, null, 2) },
      { path: '.gitignore', content: `node_modules\ndist\n.env\n*.local` },
    ],
  },
];

// ─── Template metadata cache ─────────────────────────────────────────────────
class TemplateDB extends Dexie {
  downloaded!: Table<{ id: string; downloadedAt: number }>;
  constructor() {
    super('devnoder-templates');
    this.version(1).stores({ downloaded: 'id' });
  }
}
const db = new TemplateDB();

// ─── Service ─────────────────────────────────────────────────────────────────
export class TemplateService {
  private fs: any = null;

  setFS(fs: any) { this.fs = fs; }

  list(): Template[] { return TEMPLATES; }

  get(id: string): Template | undefined {
    return TEMPLATES.find(t => t.id === id);
  }

  search(query: string): Template[] {
    const q = query.toLowerCase();
    return TEMPLATES.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.includes(q))
    );
  }

  /** Apply template: write all files into lightning-fs at the given root path */
  async apply(
    templateId: string,
    projectRoot: string,
    onProgress?: (file: string, index: number, total: number) => void,
  ): Promise<{ created: number; errors: string[] }> {
    const template = this.get(templateId);
    if (!template) throw new Error(`Unknown template: ${templateId}`);

    const fs = this.fs;
    const errors: string[] = [];
    let created = 0;

    for (let i = 0; i < template.files.length; i++) {
      const file = template.files[i];
      const fullPath = `${projectRoot}/${file.path}`;
      onProgress?.(file.path, i, template.files.length);

      try {
        // Ensure parent directories exist
        const parts = fullPath.split('/');
        for (let d = 2; d < parts.length; d++) {
          const dir = parts.slice(0, d).join('/');
          try { await fs.promises.mkdir(dir); } catch { /* exists */ }
        }
        await fs.promises.writeFile(fullPath, file.content, { encoding: 'utf8' });
        created++;
      } catch (err: any) {
        errors.push(`${file.path}: ${err.message}`);
      }
    }

    await db.downloaded.put({ id: templateId, downloadedAt: Date.now() });
    return { created, errors };
  }

  /** Generate files without writing to FS — returns a map of path→content */
  preview(templateId: string): Record<string, string> {
    const template = this.get(templateId);
    if (!template) return {};
    return Object.fromEntries(template.files.map(f => [f.path, f.content]));
  }

  async isDownloaded(id: string): Promise<boolean> {
    return !!(await db.downloaded.get(id));
  }
}

// ─── Community registry ──────────────────────────────────────────────────────
const TEMPLATES_REGISTRY_URL = 'https://devnoder-executor.srvel-build.workers.dev/templates';

export class TemplateCommunityService {
  /** Fetch community-shared templates from CF Worker / D1 */
  async fetchCommunity(): Promise<Array<Omit<Template, 'files'> & { downloadUrl: string }>> {
    try {
      const res = await fetch(TEMPLATES_REGISTRY_URL, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch {
      return []; // offline or not deployed
    }
  }

  /** Download a community template's files and register it locally */
  async installCommunity(downloadUrl: string): Promise<Template | null> {
    try {
      const res = await fetch(downloadUrl, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const template: Template = await res.json();
      // Validate minimal shape
      if (!template.id || !template.name || !template.files) throw new Error('Invalid template format');
      return template;
    } catch { return null; }
  }

  /** Publish a user-created template to the community registry */
  async publish(template: Template, authorToken: string): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const res = await fetch(`${TEMPLATES_REGISTRY_URL}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authorToken}` },
        body: JSON.stringify({
          id: template.id,
          name: template.name,
          description: template.description,
          icon: template.icon,
          tags: template.tags,
          commands: template.commands,
          files: template.files, // included for community hosting
        }),
      });
      if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
      const data = await res.json();
      return { success: true, id: data.id };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}

export const templateCommunityService = new TemplateCommunityService();
export const templateService = new TemplateService();
