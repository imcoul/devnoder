// register.ts — populate the registry with service singletons.
//
// Only objects with state/methods are registered here. Pure functions and
// constants are imported directly where needed.

import { registry, registerService, ServiceKey } from './registry';

// ─── Storage ─────────────────────────────────────────────────────────────────
import { db, getSetting, setSetting } from './storage/db';
registerService('db', () => db);
registerService('getSetting', () => getSetting);
registerService('setSetting', () => setSetting);

// ─── Security ────────────────────────────────────────────────────────────────
import { cryptoVault } from './security/CryptoVault';
registerService(ServiceKey.cryptoVault, () => cryptoVault);

import { connectionSigning } from './security/ConnectionSigning';
registerService('connectionSigning', () => connectionSigning);

import { detectSecrets } from './security/SecretDetector';
registerService('detectSecrets', () => detectSecrets);

// ─── AI / MCP ────────────────────────────────────────────────────────────────
import { mcpConfigStore } from './ai/MCPConfigStore';
registerService(ServiceKey.mcpConfigStore, () => mcpConfigStore);

import { aiGateway } from './ai/AIGateway';
registerService(ServiceKey.aiGateway, () => aiGateway);

import { embeddingEngine } from './ai/EmbeddingEngine';
registerService(ServiceKey.embeddingEngine, () => embeddingEngine);

import { BUILTINS } from './ai/BuiltinSkills';
registerService('builtinSkills', () => ({ BUILTINS }));

import { skillsEngine } from './ai/SkillsEngine';
registerService(ServiceKey.skillsEngine, () => skillsEngine);

import { parseMessage } from './ai/StreamingMessageParser';
registerService('streamingMessageParser', () => ({ parseMessage }));

import { webLLMManager } from './ai/WebLLMManager';
registerService(ServiceKey.webLLMManager, () => webLLMManager);

import { diffTracker } from './ai/DiffTracker';
registerService(ServiceKey.diffTracker, () => diffTracker);

import { feedbackStore } from './ai/FeedbackStore';
registerService(ServiceKey.feedbackStore, () => feedbackStore);

import { mcpClient } from './ai/MCPClient';
registerService('mcpClient', () => mcpClient);

// ─── Git / GitHub ────────────────────────────────────────────────────────────
import { gitHubAPI } from './git/GitHubAPI';
registerService(ServiceKey.gitHubAPI, () => gitHubAPI);

import {
  fs, $activeProjectId, setActiveProject, getDir,
  initRepo, getStatus, stageFile, unstageFile, stageAll,
  commit, getLog, getBranches, createBranch, checkoutBranch,
  deleteBranch, push, pull, clone, addRemote, readFile, writeFile, listFiles,
} from './git/GitService';
registerService(ServiceKey.gitService, () => ({
  fs, $activeProjectId, setActiveProject, getDir,
  initRepo, getStatus, stageFile, unstageFile, stageAll,
  commit, getLog, getBranches, createBranch, checkoutBranch,
  deleteBranch, push, pull, clone, addRemote, readFile, writeFile, listFiles,
}));

import { syncQueue } from './git/SyncQueue';
registerService(ServiceKey.syncQueue, () => syncQueue);

import { generateCommitMessage } from './git/CommitMessageAI';
registerService(ServiceKey.commitMessageAI, () => ({ generateCommitMessage }));

// ─── Terminal ────────────────────────────────────────────────────────────────
import { terminalSession } from './terminal/TerminalSession';
registerService(ServiceKey.terminalSession, () => terminalSession);

import { cloudExecutor } from './terminal/CloudExecutor';
registerService(ServiceKey.cloudExecutor, () => cloudExecutor);

import { wasmRuntime } from './terminal/WASMRuntime';
registerService(ServiceKey.wasmRuntime, () => wasmRuntime);

import { packageCDN } from './terminal/PackageCDN';
registerService(ServiceKey.packageCDN, () => packageCDN);

import { termuxBridge } from './terminal/TermuxBridge';
registerService(ServiceKey.termuxBridge, () => termuxBridge);

// ─── Editor ──────────────────────────────────────────────────────────────────
import { bufferManager } from './editor/BufferManager';
registerService(ServiceKey.bufferManager, () => bufferManager);

// ─── Project ─────────────────────────────────────────────────────────────────
import { projectService } from './project/ProjectService';
registerService(ServiceKey.projectService, () => projectService);

// ─── Templates ───────────────────────────────────────────────────────────────
import { templateService } from './templates/TemplateService';
registerService(ServiceKey.templateService, () => templateService);

// ─── Visual ──────────────────────────────────────────────────────────────────
import { codeSyncEngine } from './visual/CodeSyncEngine';
registerService(ServiceKey.codeSyncEngine, () => codeSyncEngine);

import { checkAccessibility } from './visual/AccessibilityChecker';
registerService('checkAccessibility', () => ({ checkAccessibility }));

// ─── Collaboration ───────────────────────────────────────────────────────────
import { collabService } from './collab/CollabService';
registerService(ServiceKey.collabService, () => collabService);

// ─── Community ───────────────────────────────────────────────────────────────
import { themeRegistry } from './community/ThemeRegistry';
registerService(ServiceKey.themeRegistry, () => themeRegistry);

import { computePool } from './community/ComputePool';
registerService(ServiceKey.computePool, () => computePool);

import { finetuneExport } from './community/FinetuneExport';
registerService(ServiceKey.finetuneExport, () => finetuneExport);

// ─── Snippets ────────────────────────────────────────────────────────────────
import { snippetService } from './snippets/SnippetService';
registerService(ServiceKey.snippetService, () => snippetService);

// ─── Docs ────────────────────────────────────────────────────────────────────
import { offlineDocsService } from './docs/OfflineDocsService';
registerService(ServiceKey.offlineDocsService, () => offlineDocsService);

// ─── Health ──────────────────────────────────────────────────────────────────
import { projectHealthService } from './health/ProjectHealthService';
registerService(ServiceKey.projectHealthService, () => projectHealthService);

// ─── Revenue ─────────────────────────────────────────────────────────────────
import { subscriptionService, PLANS } from './revenue/SubscriptionService';
registerService(ServiceKey.subscriptionService, () => ({ subscriptionService, PLANS }));

// ─── Plugins ─────────────────────────────────────────────────────────────────
import { pluginAPI } from './plugins/PluginRegistry';
registerService(ServiceKey.pluginAPI, () => pluginAPI);

// ─── Preview ─────────────────────────────────────────────────────────────────
import { previewService } from './preview/PreviewService';
registerService('previewService', () => previewService);

// ─── API Tester ──────────────────────────────────────────────────────────────
import { apiTesterService } from './api/APITesterService';
registerService(ServiceKey.apiTesterService, () => apiTesterService);

// ─── Cloud ───────────────────────────────────────────────────────────────────
import { TIER_FEATURES as CLOUD_TIER_FEATURES, TIER_PRICES as CLOUD_TIER_PRICES } from './cloud/CloudTier';
registerService(ServiceKey.cloudTier, () => ({ TIER_FEATURES: CLOUD_TIER_FEATURES, TIER_PRICES: CLOUD_TIER_PRICES }));

// ─── Storage ─────────────────────────────────────────────────────────────────
import { detectDevice } from './storage/DeviceDetector';
registerService('detectDevice', () => ({ detectDevice }));

// ─── Accessibility ───────────────────────────────────────────────────────────
import { audioCueService } from './accessibility/AudioCueService';
registerService(ServiceKey.audioCueService, () => audioCueService);

console.log(`[registry] Registered ${registry} services`);