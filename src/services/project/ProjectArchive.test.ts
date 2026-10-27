import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { buildProjectZip } from './ProjectArchive';

describe('project ZIP export', () => {
  it('preserves nested UTF-8 text files and excludes Git internals', () => {
    const built = buildProjectZip({
      'index.html': '<h1>hello</h1>',
      'src/你好.ts': 'console.log("Привет");',
      'assets/icon.bin': new Uint8Array([0, 255, 128, 42]),
      '.git/config': '[core]\nrepositoryformatversion = 0',
    });
    const files = unzipSync(built.archiveBytes);

    expect(built.fileCount).toBe(3);
    expect(strFromU8(files['index.html'])).toBe('<h1>hello</h1>');
    expect(strFromU8(files['src/你好.ts'])).toBe('console.log("Привет");');
    expect([...files['assets/icon.bin']]).toEqual([0, 255, 128, 42]);
    expect(files['.git/config']).toBeUndefined();
  });

  it.each(['../outside.txt', '/outside.txt', 'src/../../outside.txt', 'src\\outside.txt'])('rejects unsafe archive path %j', path => {
      expect(() => buildProjectZip({ [path]: 'not safe' })).toThrow();
    });
});
