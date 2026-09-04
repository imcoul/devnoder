import { describe, it, expect, afterEach } from 'vitest';
import { connectionSigning } from './ConnectionSigning';

describe('connectionSigning', () => {
  const ids: string[] = [];
  const makeId = () => {
    const id = `test-${crypto.randomUUID()}`;
    ids.push(id);
    return id;
  };

  afterEach(async () => {
    await Promise.all(ids.splice(0).map(id => connectionSigning.revokeIdentity(id)));
  });

  it('has no identity before one is generated', async () => {
    const id = makeId();
    expect(await connectionSigning.hasIdentity(id)).toBe(false);
    expect(await connectionSigning.getPublicKey(id)).toBeUndefined();
  });

  it('generates a real, usable public key', async () => {
    const id = makeId();
    const pub = await connectionSigning.generateIdentity(id);
    expect(pub.kty).toBe('EC');
    expect(pub.crv).toBe('P-256');
    expect(await connectionSigning.hasIdentity(id)).toBe(true);
    expect(await connectionSigning.getPublicKey(id)).toEqual(pub);
  });

  it('signs and verifies a payload correctly', async () => {
    const id = makeId();
    const pub = await connectionSigning.generateIdentity(id);
    const sig = await connectionSigning.sign(id, 'hello world');
    expect(await connectionSigning.verify(pub, 'hello world', sig)).toBe(true);
  });

  it('rejects a tampered payload', async () => {
    const id = makeId();
    const pub = await connectionSigning.generateIdentity(id);
    const sig = await connectionSigning.sign(id, 'hello world');
    expect(await connectionSigning.verify(pub, 'hello WORLD', sig)).toBe(false);
  });

  it('rejects a signature made by a different identity', async () => {
    const idA = makeId();
    const idB = makeId();
    const pubA = await connectionSigning.generateIdentity(idA);
    await connectionSigning.generateIdentity(idB);
    const sigFromB = await connectionSigning.sign(idB, 'hello world');
    expect(await connectionSigning.verify(pubA, 'hello world', sigFromB)).toBe(false);
  });

  it('throws when signing without a generated identity', async () => {
    const id = makeId();
    await expect(connectionSigning.sign(id, 'hello')).rejects.toThrow(/No signing identity/);
  });

  it('revoke removes the identity', async () => {
    const id = makeId();
    await connectionSigning.generateIdentity(id);
    await connectionSigning.revokeIdentity(id);
    expect(await connectionSigning.hasIdentity(id)).toBe(false);
  });
});
