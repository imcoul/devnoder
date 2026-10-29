import { describe, expect, it, vi } from 'vitest';

const put = vi.hoisted(() => vi.fn());
vi.mock('../storage/db', () => ({ db: { plugins: { put } } }));
import { pluginAPI } from './PluginAPI';

describe('unconfigured registry plugin gates', () => {
  it('exposes planned registry entries without fictitious hosted artifacts', async () => {
    const entries = await pluginAPI.getRegistry();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every(entry => entry.entryUrl === '')).toBe(true);
  });
  it('refuses a placeholder install before persisting a fake enabled plugin', async () => {
    const [entry] = await pluginAPI.getRegistry();
    await expect(pluginAPI.install(entry.id)).rejects.toThrow('not configured');
    expect(put).not.toHaveBeenCalled();
  });
  it('rejects a nonexistent registry ID rather than inventing a plugin', async () => {
    await expect(pluginAPI.install('does-not-exist')).rejects.toThrow('not found');
    expect(put).not.toHaveBeenCalled();
  });
});
