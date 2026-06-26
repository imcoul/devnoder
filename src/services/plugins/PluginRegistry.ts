// PluginRegistry.ts — canonical alias for PluginAPI.ts
export * from './PluginAPI';
export async function initBuiltinPlugins(): Promise<void> { /* built-ins auto-init in PluginAPI */ }
export async function restorePlugins(): Promise<void> { /* plugins restored in PluginAPI */ }
