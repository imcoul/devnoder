import { describe, expect, it } from 'vitest';
import { computePool } from './ComputePool';

describe('ComputePool', () => {
  it('refuses to mark this browser as contributing while the service is unconfigured', () => {
    expect(computePool.isContributing()).toBe(false);
    expect(() => computePool.startContributing()).toThrow('Community compute is not configured');
    expect(computePool.isContributing()).toBe(false);
  });
});
