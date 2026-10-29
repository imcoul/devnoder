export interface PrebuiltLocalModel {
  id: string;
  repository: string;
  vramRequiredMB?: number;
  lowResourceRequired: boolean;
}

export interface SavedLocalModel {
  id: string;
  label: string;
  provider?: 'webllm' | 'transformers';
  transformersModelId?: string;
  transformersDtype?: 'q4' | 'q8';
  vramRequiredMB?: number;
  lowResourceRequired?: boolean;
}

const SAVED_MODELS_KEY = 'devnoder-prebuilt-local-models';

export function isValidTransformersRepoId(value: string): boolean {
  const id = value.trim();
  if (id !== value || id.includes('..')) return false;
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}\/[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(id);
}

/**
 * Return only chat models whose prebuilt runtime library is shipped in the
 * currently installed WebLLM registry. This intentionally does not accept
 * arbitrary Hugging Face IDs or GGUF files.
 */
export async function listPrebuiltLocalModels(): Promise<PrebuiltLocalModel[]> {
  const { prebuiltAppConfig, ModelType } = await import('@mlc-ai/web-llm');
  return prebuiltAppConfig.model_list
    .filter(model => model.model_type == null || model.model_type === ModelType.LLM)
    .map(model => ({
      id: model.model_id,
      repository: model.model,
      vramRequiredMB: model.vram_required_MB,
      lowResourceRequired: model.low_resource_required ?? false,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function readSavedLocalModels(): SavedLocalModel[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SAVED_MODELS_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SavedLocalModel =>
      typeof item === 'object' && item !== null &&
      typeof (item as SavedLocalModel).id === 'string' &&
      typeof (item as SavedLocalModel).label === 'string' &&
      ((item as SavedLocalModel).provider === undefined ||
        (item as SavedLocalModel).provider === 'webllm' ||
        (item as SavedLocalModel).provider === 'transformers') &&
      ((item as SavedLocalModel).provider !== 'transformers' ||
        (typeof (item as SavedLocalModel).transformersModelId === 'string' &&
          isValidTransformersRepoId((item as SavedLocalModel).transformersModelId!) &&
          (item as SavedLocalModel).id === `transformers:${(item as SavedLocalModel).transformersModelId}`)) &&
      ((item as SavedLocalModel).transformersDtype === undefined ||
        (item as SavedLocalModel).transformersDtype === 'q4' ||
        (item as SavedLocalModel).transformersDtype === 'q8') &&
      ((item as SavedLocalModel).vramRequiredMB === undefined ||
        (typeof (item as SavedLocalModel).vramRequiredMB === 'number' &&
          Number.isFinite((item as SavedLocalModel).vramRequiredMB))) &&
      ((item as SavedLocalModel).lowResourceRequired === undefined ||
        typeof (item as SavedLocalModel).lowResourceRequired === 'boolean')
    ).slice(0, 200);
  } catch {
    return [];
  }
}

export function writeSavedLocalModels(models: SavedLocalModel[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SAVED_MODELS_KEY, JSON.stringify(models.slice(0, 200)));
}
