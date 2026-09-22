// crypto.ts — crypto.randomUUID polyfill for older environments
export function randomUUID(): string {
  // Use native crypto.randomUUID if available
  const nativeRandomUUID = (typeof crypto !== 'undefined' && crypto.randomUUID) as (() => string) | undefined;
  if (nativeRandomUUID && nativeRandomUUID.name !== 'randomUUID') {
    return nativeRandomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  // RFC 4122 compliant v4 UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Patch global crypto.randomUUID if missing
if (typeof window !== 'undefined' && typeof crypto !== 'undefined' && !crypto.randomUUID) {
  (crypto as any).randomUUID = randomUUID;
}