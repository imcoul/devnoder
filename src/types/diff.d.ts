declare module 'jsdiff' {
  export interface Diff {
    value: string;
    added?: boolean;
    removed?: boolean;
  }

  export function createPatch(
    fileName: string,
    oldText: string,
    newText: string,
    oldHeader?: string,
    newHeader?: string,
    options?: { context?: number }
  ): string;
}
