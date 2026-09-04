// ConnectionSigning.ts — per-connection asymmetric identity (ECDSA P-256).
//
// This is groundwork for Phase 9's "mutual verification, not one-way trust":
// each MCP connection can get its own signing keypair, whose public half is
// meant to be handed to the counterparty (LogoForge, a future Srvel In) to
// register, replacing the single-static-shared-secret pattern sketched
// elsewhere in Srvel's docs. Be honest about its current reach: nothing on
// the receiving end of any connection wired up today (Notion, GitHub, the
// generic presets) verifies these signatures — there's no such counterparty
// yet. What's implemented and verified here is the primitive itself: a real
// keypair is generated, the private half never leaves this module in
// extractable form, and sign()/verify() round-trip correctly. Wiring this
// into an actual outgoing request is Phase 10's job, once a real
// signature-aware counterparty exists to receive it.
import Dexie, { Table } from 'dexie';

interface SigningKeyRecord {
  serverId: string;
  privateKey: CryptoKey;   // non-extractable — see generateIdentity()
  publicJwk: string;       // JSON — public keys are meant to be shared, no encryption needed
  createdAt: number;
}

class SigningKeyDB extends Dexie {
  keys!: Table<SigningKeyRecord>;
  constructor() {
    super('devnoder-connection-signing');
    this.version(1).stores({ keys: 'serverId' });
  }
}

const db = new SigningKeyDB();
const ALGO = { name: 'ECDSA', namedCurve: 'P-256' } as const;

function toBase64(bytes: ArrayBuffer): string {
  let bin = '';
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

export const connectionSigning = {
  /** Generates a new identity for a connection, replacing any existing one.
   * Returns the public key (JWK) to hand to the counterparty for registration. */
  async generateIdentity(serverId: string): Promise<JsonWebKey> {
    const pair = await crypto.subtle.generateKey(ALGO, true, ['sign', 'verify']);
    const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);

    // Re-import the private key as non-extractable before persisting it —
    // the brief extractable window above only exists because WebCrypto's
    // generateKey can't set extractability separately per half of a pair;
    // once stored, this key can never be exported again, only used in place
    // (crypto.subtle.sign), matching CryptoVault's device-key model.
    const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
    const nonExtractablePrivate = await crypto.subtle.importKey('jwk', privateJwk, ALGO, false, ['sign']);

    await db.keys.put({
      serverId, privateKey: nonExtractablePrivate,
      publicJwk: JSON.stringify(publicJwk), createdAt: Date.now(),
    });
    return publicJwk;
  },

  async hasIdentity(serverId: string): Promise<boolean> {
    return (await db.keys.get(serverId)) !== undefined;
  },

  async getPublicKey(serverId: string): Promise<JsonWebKey | undefined> {
    const rec = await db.keys.get(serverId);
    return rec ? JSON.parse(rec.publicJwk) : undefined;
  },

  async revokeIdentity(serverId: string): Promise<void> {
    await db.keys.delete(serverId);
  },

  /** Signs a UTF-8 payload with the connection's private key. Throws if no
   * identity has been generated for this serverId. */
  async sign(serverId: string, payload: string): Promise<string> {
    const rec = await db.keys.get(serverId);
    if (!rec) throw new Error(`No signing identity for ${serverId} — call generateIdentity() first`);
    const sig = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' }, rec.privateKey, new TextEncoder().encode(payload)
    );
    return toBase64(sig);
  },

  /** Verifies a signature against a public key JWK — usable against this
   * connection's own key (self-test) or, once Phase 10 wires it up, a
   * counterparty's registered public key. */
  async verify(publicJwk: JsonWebKey, payload: string, signatureB64: string): Promise<boolean> {
    try {
      const key = await crypto.subtle.importKey('jwk', publicJwk, ALGO, false, ['verify']);
      return await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' }, key, new Uint8Array(fromBase64(signatureB64)), new TextEncoder().encode(payload)
      );
    } catch {
      return false;
    }
  },
};
