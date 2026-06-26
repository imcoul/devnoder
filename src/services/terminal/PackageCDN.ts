// PackageCDN.ts — esm.sh resolver, simulates npm install for browser
export interface ResolvedPackage {
  name: string;
  version: string;
  url: string;
  types?: string;
}

const CDN_BASE = 'https://esm.sh';
const resolved = new Map<string, ResolvedPackage>();

export const packageCDN = {
  async resolve(spec: string): Promise<ResolvedPackage> {
    if (resolved.has(spec)) return resolved.get(spec)!;
    const [name, version] = spec.includes('@') && !spec.startsWith('@')
      ? spec.split('@') : [spec, 'latest'];
    const url = `${CDN_BASE}/${name}${version && version !== 'latest' ? `@${version}` : ''}`;
    const pkg: ResolvedPackage = { name, version: version ?? 'latest', url };
    resolved.set(spec, pkg);
    return pkg;
  },

  async install(packages: string[], onProgress?: (pkg: string) => void): Promise<string> {
    const imports: string[] = [];
    for (const pkg of packages) {
      onProgress?.(pkg);
      const { url, name } = await this.resolve(pkg);
      const identifier = name.replace(/[@\-\/]/g, '_').replace(/^_/, '');
      imports.push(`import * as ${identifier} from '${url}';`);
    }
    return imports.join('\n');
  },

  parseInstallArgs(args: string): string[] {
    return args.trim().split(/\s+/).filter(a => !a.startsWith('-') && a);
  },
};
