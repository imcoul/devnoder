import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  existing: [] as Array<{ id: string; name: string; systemPromptPrefix: string }>,
  save: vi.fn(),
}));
vi.mock('./SkillStore', () => ({ skillStore: {
  getBySource: vi.fn(async () => mocks.existing),
  save: mocks.save,
} }));
import { seedBuiltinSkills } from './BuiltinSkills';

describe('built-in brand font migration', () => {
  beforeEach(() => { mocks.existing = []; mocks.save.mockReset(); });
  it('replaces retired fonts without overwriting a custom prompt suffix', async () => {
    mocks.existing = [{ id: 'builtin-srvel-brand', name: 'My brand guidance', systemPromptPrefix: "--font-display: 'Comfortaa'; --font-body: 'Quicksand';\nKeep my custom colors." }];
    await seedBuiltinSkills();
    const saved = mocks.save.mock.calls.map(call => call[0]).find(record => record.id === 'builtin-srvel-brand');
    expect(saved.name).toBe('My brand guidance');
    expect(saved.systemPromptPrefix).toBe("--font-display: 'Instrument Sans'; --font-body: 'Livvic';\nKeep my custom colors.");
  });
  it('does not rewrite an already-current customized brand prompt', async () => {
    mocks.existing = [{ id: 'builtin-srvel-brand', name: 'Custom brand', systemPromptPrefix: "'Instrument Sans' / 'Livvic' / my content" }];
    await seedBuiltinSkills();
    expect(mocks.save.mock.calls.some(call => call[0].id === 'builtin-srvel-brand')).toBe(false);
  });
  it('seeds current defaults when the built-in record is absent', async () => {
    await seedBuiltinSkills();
    const saved = mocks.save.mock.calls.map(call => call[0]).find(record => record.id === 'builtin-srvel-brand');
    expect(saved.systemPromptPrefix).toContain('Instrument Sans');
    expect(saved.systemPromptPrefix).toContain('Livvic');
  });
});
