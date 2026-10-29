export interface LocalModelStatusInput {
  offlineCapable: boolean;
  loaded: boolean;
  hasProgress: boolean;
  cachedFiles: boolean | null;
  configured: boolean;
}

/**
 * Derive user-visible readiness from the authoritative runtime state first.
 * A final progress callback can arrive at 100% before React observes the loaded
 * engine, so progress must never override a model that is already ready.
 */
export function getLocalModelStatus({
  offlineCapable,
  loaded,
  hasProgress,
  cachedFiles,
  configured,
}: LocalModelStatusInput): string {
  if (!offlineCapable) return configured ? 'Ready to use' : 'Requires setup';
  if (loaded) return 'Ready in this tab';
  if (hasProgress) return 'Downloading';
  if (cachedFiles === true) return 'Requires setup';
  if (cachedFiles === false) return 'Not set up';
  return 'Checking setup…';
}
