export interface DeviceProfile {
  isAndroid: boolean;
  isMobile: boolean;
  hasWebGPU: boolean;
  hasWASM: boolean;
  ramGB: number;
  isSamsungA72: boolean;
  recommendedModel: string;
  touchPrimary: boolean;
}

export async function detectDevice(): Promise<DeviceProfile> {
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || window.innerWidth < 768;
  const isSamsungA72 = /SM-A725/i.test(ua);
  const hasWASM = typeof WebAssembly === 'object';
  const hasWebGPU = 'gpu' in navigator;
  const ramGB = (navigator as any).deviceMemory ?? 4;
  const recommendedModel = ramGB >= 6 && hasWebGPU
    ? 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC'
    : 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC';

  return { isAndroid, isMobile, hasWebGPU, hasWASM, ramGB, isSamsungA72, recommendedModel, touchPrimary: isMobile };
}
