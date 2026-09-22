// crypto.ts — crypto.randomUUID polyfill + utility functions for older environments
export function randomUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID.call(crypto);
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateId(): string {
  return randomUUID();
}

export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export function stableStringify(obj: unknown): string {
  const seen = new WeakSet();
  const helper = (value: unknown): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'null';
    const type = typeof value;
    if (type === 'boolean') return value ? 'true' : 'false';
    if (type === 'number') return isFinite(value as number) ? String(value) : 'null';
    if (type === 'string') return JSON.stringify(value);
    if (type === 'function' || type === 'symbol') return 'null';
    if (type === 'bigint') return `"${value}"`;
    if (Array.isArray(value)) {
      if (seen.has(value)) return '"[Circular]"';
      seen.add(value);
      return '[' + value.map(helper).join(',') + ']';
    }
    if (type === 'object') {
      if (seen.has(value)) return '"[Circular]"';
      seen.add(value);
      const keys = Object.keys(value as Record<string, unknown>).sort();
      const entries = keys.map(k => JSON.stringify(k) + ':' + helper((value as Record<string, unknown>)[k]));
      return '{' + entries.join(',') + '}';
    }
    return 'null';
  };
  return helper(obj);
}

export async function hashString(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Patch global crypto.randomUUID if missing
if (typeof window !== 'undefined' && typeof crypto !== 'undefined' && !crypto.randomUUID) {
  (crypto as any).randomUUID = randomUUID;
}
