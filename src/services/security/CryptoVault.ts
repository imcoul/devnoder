// CryptoVault.ts — device-bound encryption at rest for stored credentials.
//
// AI provider keys and MCP server tokens were stored as plaintext strings in
// localStorage/IndexedDB — readable by anything with access to the browser's
// storage (a malicious extension, another script on the same origin, direct
// disk access). This raises the bar against exactly that: casual access to
// the stored value. It does NOT defend against active XSS in this origin —
// nothing purely client-side can, since the decryption key has to be
// reachable by the same code that would be compromised. Be honest about that
// limitation wherever this is surfaced in the UI.
//
// No passphrase prompt: the key is a non-extractable AES-GCM CryptoKey
// generated once and kept in IndexedDB (natively structured-cloneable in
// modern browsers — Chrome/Firefox support storing CryptoKey objects
// directly). Usable with zero UX change to existing setKey/getKey call sites.

import Dexie, { Table } from 'dexie';

interface KeyRecord { id: string; key: CryptoKey }

class VaultDB extends Dexie {
  keys!: Table<KeyRecord>;
  constructor() {
    super('devnoder-vault');
    this.version(1).stores({ keys: 'id' });
  }
}

const db = new VaultDB();
let cachedKey: CryptoKey | null = null;

async function getOrCreateKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const existing = await db.keys.get('device-key');
  if (existing) { cachedKey = existing.key; return existing.key; }

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await db.keys.put({ id: 'device-key', key });
  cachedKey = key;
  return key;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

export const cryptoVault = {
  /** Encrypts plaintext into a single base64 string (IV prefix + ciphertext). */
  async encrypt(plaintext: string): Promise<string> {
    const key = await getOrCreateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);
    return toBase64(combined);
  },

  /** Decrypts a string produced by encrypt(). Returns null on any failure
   * (corrupt data, wrong key) rather than throwing — callers should treat
   * that the same as "no stored value". */
  async decrypt(encoded: string): Promise<string | null> {
    try {
      const key = await getOrCreateKey();
      const combined = fromBase64(encoded);
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);
      const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
      return new TextDecoder().decode(plaintext);
    } catch {
      return null;
    }
  },
};
