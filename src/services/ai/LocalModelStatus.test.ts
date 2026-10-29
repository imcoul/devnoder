import { describe, expect, it } from 'vitest';
import { getLocalModelStatus, type LocalModelStatusInput } from './LocalModelStatus';

describe('getLocalModelStatus', () => {
  const base: LocalModelStatusInput = {
    offlineCapable: true,
    loaded: false,
    hasProgress: false,
    cachedFiles: null,
    configured: false,
  };

  it('shows readiness when the runtime is loaded even if a final progress event remains', () => {
    expect(getLocalModelStatus({ ...base, loaded: true, hasProgress: true }))
      .toBe('Ready in this tab');
  });

  it('shows downloading only while a model is not yet loaded', () => {
    expect(getLocalModelStatus({ ...base, hasProgress: true })).toBe('Downloading');
  });

  it('asks the user to load an already-cached model', () => {
    expect(getLocalModelStatus({ ...base, cachedFiles: true })).toBe('Requires setup');
  });

  it('identifies an uncached model', () => {
    expect(getLocalModelStatus({ ...base, cachedFiles: false })).toBe('Not set up');
  });

  it('keeps cache uncertainty distinct from a missing model', () => {
    expect(getLocalModelStatus(base)).toBe('Checking setup…');
  });

  it('uses provider setup readiness for hosted models', () => {
    expect(getLocalModelStatus({ ...base, offlineCapable: false, configured: true }))
      .toBe('Ready to use');
    expect(getLocalModelStatus({ ...base, offlineCapable: false, configured: false }))
      .toBe('Requires setup');
  });
});
