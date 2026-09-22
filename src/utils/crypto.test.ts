import { describe, it, expect } from 'vitest';
import { generateId, stableStringify, isValidUUID, hashString } from './crypto';

describe('crypto utilities', () => {
  it('generateId produces a UUID string', () => {
    const id = generateId();
    expect(isValidUUID(id)).toBe(true);
  });

  it('generateId produces unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it('stableStringify produces deterministic output', () => {
    const obj = { b: 2, a: 1, c: { d: 3 } };
    const first = stableStringify(obj);
    const second = stableStringify({ b: 2, a: 1, c: { d: 3 } });
    expect(first).toBe(second);
    expect(first).toBe('{"a":1,"b":2,"c":{"d":3}}');
  });

  it('hashString returns a hex string of expected length', async () => {
    const hash = await hashString('hello');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashString is deterministic', async () => {
    expect(await hashString('hello')).toBe(await hashString('hello'));
  });

  it('hashString changes with input', async () => {
    expect(await hashString('hello')).not.toBe(await hashString('world'));
  });
});
