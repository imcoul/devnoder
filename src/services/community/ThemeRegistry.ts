// ThemeRegistry.ts — share/download community themes
import Dexie, { Table } from 'dexie';

export interface CommunityTheme {
  id: string;
  name: string;
  author: string;
  description: string;
  downloads: number;
  rating: number;
  tokens: Record<string, string>;  // CSS variable overrides
  previewColors: string[];
  createdAt: number;
  tags: string[];
}

class ThemeDB extends Dexie {
  installed!: Table<CommunityTheme & { installedAt: number }>;
  constructor() {
    super('devnoder-themes');
    this.version(1).stores({ installed: 'id, name, installedAt' });
  }
}

const db = new ThemeDB();

// Mock registry — in prod, fetch from Cloudflare Worker + D1
const MOCK_REGISTRY: CommunityTheme[] = [
  {
    id: 'srvel-ocean',
    name: 'Srvel Ocean',
    author: 'Srvel Team',
    description: 'Deep ocean blues with turquoise accents — the official Srvel dark theme',
    downloads: 1420,
    rating: 4.9,
    tokens: {
      '--color-canvas': '#030d1a', '--color-surface': '#071628',
      '--color-border': '#0d2f4a', '--color-text': '#cde4f5',
      '--color-turquoise': '#00cfff', '--color-yellow': '#ffe066',
      '--color-purple': '#9d4edd',
    },
    previewColors: ['#030d1a', '#00cfff', '#ffe066', '#9d4edd'],
    createdAt: Date.now() - 86400000 * 30,
    tags: ['dark', 'ocean', 'official'],
  },
  {
    id: 'desert-sand',
    name: 'Desert Sand',
    author: 'community',
    description: 'Warm sand tones, easy on the eyes during long sessions',
    downloads: 832,
    rating: 4.5,
    tokens: {
      '--color-canvas': '#1a1308', '--color-surface': '#241c0f',
      '--color-border': '#3d3010', '--color-text': '#f5e6c8',
      '--color-turquoise': '#d4a017', '--color-yellow': '#f0e68c',
      '--color-purple': '#c2785c',
    },
    previewColors: ['#1a1308', '#d4a017', '#f0e68c', '#c2785c'],
    createdAt: Date.now() - 86400000 * 14,
    tags: ['dark', 'warm', 'desert'],
  },
  {
    id: 'mint-light',
    name: 'Mint Light',
    author: 'community',
    description: 'Clean mint-tinted light theme with soft contrast',
    downloads: 654,
    rating: 4.3,
    tokens: {
      '--color-canvas': '#f0faf8', '--color-surface': '#e0f5f0',
      '--color-border': '#b2ddd6', '--color-text': '#0d2926',
      '--color-text-muted': '#3d7a72', '--color-turquoise': '#00897b',
      '--color-yellow': '#f9a825', '--color-purple': '#6a1b9a',
    },
    previewColors: ['#f0faf8', '#00897b', '#f9a825', '#6a1b9a'],
    createdAt: Date.now() - 86400000 * 7,
    tags: ['light', 'mint', 'clean'],
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk 2077',
    author: 'community',
    description: 'Neon yellow on deep black — maximum vibe',
    downloads: 1203,
    rating: 4.7,
    tokens: {
      '--color-canvas': '#050505', '--color-surface': '#0d0d0d',
      '--color-border': '#1a1a1a', '--color-text': '#f8f8f8',
      '--color-turquoise': '#fcee09', '--color-yellow': '#fcee09',
      '--color-purple': '#f706cf', '--color-error': '#f706cf',
      '--color-success': '#00ff9d',
    },
    previewColors: ['#050505', '#fcee09', '#f706cf', '#00ff9d'],
    createdAt: Date.now() - 86400000 * 5,
    tags: ['dark', 'neon', 'cyberpunk'],
  },
];

export const themeRegistry = {
  async browse(query = '', tag = ''): Promise<CommunityTheme[]> {
    let themes = MOCK_REGISTRY;
    if (query) themes = themes.filter(t =>
      t.name.toLowerCase().includes(query.toLowerCase()) ||
      t.author.toLowerCase().includes(query.toLowerCase()) ||
      t.description.toLowerCase().includes(query.toLowerCase())
    );
    if (tag) themes = themes.filter(t => t.tags.includes(tag));
    return themes.sort((a, b) => b.downloads - a.downloads);
  },

  async install(theme: CommunityTheme): Promise<void> {
    await db.installed.put({ ...theme, installedAt: Date.now() });
    this.apply(theme);
  },

  async uninstall(id: string): Promise<void> {
    await db.installed.delete(id);
  },

  async getInstalled(): Promise<CommunityTheme[]> {
    return db.installed.orderBy('installedAt').reverse().toArray();
  },

  apply(theme: CommunityTheme): void {
    const root = document.documentElement;
    Object.entries(theme.tokens).forEach(([k, v]) => root.style.setProperty(k, v));
    localStorage.setItem('devnoder-community-theme', theme.id);
    localStorage.setItem('devnoder-community-theme-tokens', JSON.stringify(theme.tokens));
  },

  reapplySaved(): void {
    try {
      const tokens = JSON.parse(localStorage.getItem('devnoder-community-theme-tokens') ?? '{}');
      const root = document.documentElement;
      Object.entries(tokens).forEach(([k, v]) => root.style.setProperty(k, String(v)));
    } catch {}
  },

  clearApplied(): void {
    const root = document.documentElement;
    // Remove inline styles to fall back to CSS theme vars
    root.removeAttribute('style');
    localStorage.removeItem('devnoder-community-theme');
    localStorage.removeItem('devnoder-community-theme-tokens');
  },

  async publish(theme: Omit<CommunityTheme, 'id' | 'downloads' | 'rating' | 'createdAt'>): Promise<string> {
    // In prod: POST to Cloudflare Worker → D1
    const id = `user-${Date.now().toString(36)}`;
    console.log('Publishing theme:', { ...theme, id });
    return id;
  },

  allTags(): string[] {
    return [...new Set(MOCK_REGISTRY.flatMap(t => t.tags))];
  },
};
