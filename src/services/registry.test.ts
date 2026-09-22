import { describe, it, expect, beforeEach } from 'vitest';
import { createRegistry, registry, registerService } from './registry';

const CRYPTO_VAULT = 'cryptoVault';
const MCP_CONFIG_STORE = 'mcpConfigStore';
const AI_GATEWAY = 'aiGateway';

describe('ServiceRegistry', () => {
  let testRegistry: ReturnType<typeof createRegistry>;

  beforeEach(() => {
    testRegistry = createRegistry();
  });

  it('registers and retrieves a service', () => {
    const service = { name: 'test' };
    testRegistry.register(CRYPTO_VAULT, () => service);
    expect(testRegistry.get(CRYPTO_VAULT)).toBe(service);
  });

  it('throws when retrieving unregistered service', () => {
    expect(() => testRegistry.get(CRYPTO_VAULT)).toThrow('not registered');
  });

  it('caches singleton instance', () => {
    const factory = () => ({ id: Math.random() });
    testRegistry.register(MCP_CONFIG_STORE, factory);
    const a = testRegistry.get(MCP_CONFIG_STORE);
    const b = testRegistry.get(MCP_CONFIG_STORE);
    expect(a).toBe(b);
  });

  it('handles multiple services independently', () => {
    const serviceA = { name: 'a' };
    const serviceB = { name: 'b' };
    testRegistry.register(CRYPTO_VAULT, () => serviceA);
    testRegistry.register(AI_GATEWAY, () => serviceB);
    expect(testRegistry.get(CRYPTO_VAULT)).toBe(serviceA);
    expect(testRegistry.get(AI_GATEWAY)).toBe(serviceB);
  });

  it('global registry registerService/getService work', () => {
    const service = { name: 'global' };
    registerService(CRYPTO_VAULT, () => service);
    expect(registry.get(CRYPTO_VAULT)).toBe(service);
  });
});
