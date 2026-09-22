// registry.ts — lightweight service registry for the browser.
//
// Why: 25+ global singletons made testing impossible and created circular-import
// landmines. This registry makes dependencies explicit and testable.
//
// How:
//   registerService(key, factory) — register a singleton factory
//   getService<T>(key)           — retrieve (or create) the singleton
//   registry.reset()             — clear all cached instances (for tests)
//
// Type safety: the registry itself is untyped because the services have
// incompatible shapes. Consumers cast to the expected type at the call site.

type Factory = () => unknown;

interface ServiceRegistry {
  register(key: string, factory: Factory): void;
  get<T>(key: string): T;
  has(key: string): boolean;
  reset(): void;
}

class RegistryImpl implements ServiceRegistry {
  private factories = new Map<string, Factory>();
  private instances = new Map<string, unknown>();

  register(key: string, factory: Factory) {
    if (this.factories.has(key)) {
      console.warn(`[registry] ${key} re-registered`);
    }
    this.factories.set(key, factory);
    this.instances.delete(key);
  }

  get<T>(key: string): T {
    if (this.instances.has(key)) return this.instances.get(key) as T;
    const factory = this.factories.get(key);
    if (!factory) throw new Error(`[registry] ${key} not registered. Import its module first.`);
    const instance = factory();
    this.instances.set(key, instance);
    return instance as T;
  }

  has(key: string) { return this.factories.has(key); }

  reset() {
    this.instances.clear();
  }
}

export const registry = new RegistryImpl();

export function createRegistry(): ServiceRegistry {
  return new RegistryImpl();
}

export function registerService(key: string, factory: Factory) {
  registry.register(key, factory);
}

export function getService<T>(key: string): T {
  return registry.get<T>(key);
}

// ─── Service Keys ─────────────────────────────────────────────────────────────
// Use these constants instead of magic strings to avoid typos.
export const ServiceKey = {
  cryptoVault: 'cryptoVault',
  mcpConfigStore: 'mcpConfigStore',
  aiGateway: 'aiGateway',
  gitHubAPI: 'gitHubAPI',
  terminalSession: 'terminalSession',
  cloudExecutor: 'cloudExecutor',
  embeddingEngine: 'embeddingEngine',
  templateService: 'templateService',
  projectService: 'projectService',
  bufferManager: 'bufferManager',
  codeSyncEngine: 'codeSyncEngine',
  syncQueue: 'syncQueue',
  audioCueService: 'audioCueService',
  themeRegistry: 'themeRegistry',
  computePool: 'computePool',
  finetuneExport: 'finetuneExport',
  collabService: 'collabService',
  snippetService: 'snippetService',
  secretDetector: 'secretDetector',
  projectHealthService: 'projectHealthService',
  subscriptionService: 'subscriptionService',
  pluginRegistry: 'pluginRegistry',
  pluginAPI: 'pluginAPI',
  offlineDocsService: 'offlineDocsService',
  commitMessageAI: 'commitMessageAI',
  gitService: 'gitService',
  wasmRuntime: 'wasmRuntime',
  packageCDN: 'packageCDN',
  termuxBridge: 'termuxBridge',
  builtinSkills: 'builtinSkills',
  skillsEngine: 'skillsEngine',
  streamingMessageParser: 'streamingMessageParser',
  webLLMManager: 'webLLMManager',
  diffTracker: 'diffTracker',
  feedbackStore: 'feedbackStore',
  apiTesterService: 'apiTesterService',
  cloudTier: 'cloudTier',
  accessibilityChecker: 'accessibilityChecker',
} as const;

export type ServiceKey = typeof ServiceKey[keyof typeof ServiceKey];