import { describe, it, expect, afterEach } from 'vitest';
import { marketplaceStore, type MarketplaceEntry } from './MCPMarketplaceStore';

describe('marketplaceStore', () => {
  afterEach(async () => {
    // no persisted state to clean up — catalog is static
  });

  it('search matches by name, description, and tags', async () => {
    const results = await marketplaceStore.search('git');
    expect(results.some(e => e.id === 'git')).toBe(true);
    expect(results.some(e => e.id === 'github')).toBe(true);
    expect(results.some(e => e.id === 'filesystem')).toBe(false);
  });

  it('search is case-insensitive', async () => {
    const results = await marketplaceStore.search('GIT');
    expect(results.some(e => e.id === 'git')).toBe(true);
  });

  it('empty query returns the full catalog', async () => {
    const results = await marketplaceStore.search('');
    expect(results.length).toBeGreaterThan(10);
  });

  it('getById returns the matching entry', async () => {
    const entry = await marketplaceStore.getById('filesystem');
    expect(entry?.name).toBe('Filesystem');
  });

  it('getById returns undefined for unknown ids', async () => {
    expect(await marketplaceStore.getById('nonexistent')).toBeUndefined();
  });

  it('getByTag filters by a single tag', async () => {
    const results = await marketplaceStore.getByTag('database');
    expect(results.every(e => e.tags.includes('database'))).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it('tags returns the deduplicated sorted tag list', async () => {
    const tags = await marketplaceStore.tags();
    expect(tags).toEqual(expect.arrayContaining(['files', 'git', 'database']));
    expect(tags).toEqual([...new Set(tags)].sort());
  });

  it('toDraft converts a marketplace entry to an MCPServerConfig draft', async () => {
    const entry = (await marketplaceStore.getById('fetch'))!;
    const draft = marketplaceStore.toDraft(entry);
    expect(draft).toMatchObject({
      name: 'Fetch',
      icon: '🌐',
      transport: 'stdio',
      command: 'npx -y @modelcontextprotocol/server-fetch',
      capabilities: ['network'],
    });
    expect((draft as any).id).toBeUndefined();
    expect((draft as any).addedAt).toBeUndefined();
    expect((draft as any).enabled).toBeUndefined();
  });

  it('search with tags narrows results', async () => {
    const all = await marketplaceStore.search('');
    const dbOnly = await marketplaceStore.search('', ['database']);
    expect(dbOnly.length).toBeLessThan(all.length);
    expect(dbOnly.every(e => e.tags.includes('database'))).toBe(true);
  });
});
