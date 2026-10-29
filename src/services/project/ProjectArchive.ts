import { strToU8, zipSync } from 'fflate';
import { bufferManager } from '../editor/BufferManager';
import { $activeProjectId, listFiles, normalizeProjectPath, readFileBytes } from '../git/GitService';
import { db } from '../storage/db';

const MAX_ARCHIVE_FILES = 20_000;
const MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;

export interface ProjectArchive {
  blob: Blob;
  filename: string;
  fileCount: number;
  uncompressedBytes: number;
}

export interface BuiltProjectZip {
  archiveBytes: Uint8Array;
  fileCount: number;
  uncompressedBytes: number;
}

function safeFileSlug(value: string): string {
  const slug = value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return slug || 'devnoder-project';
}

export function buildProjectZip(contents: Record<string, string | Uint8Array>): BuiltProjectZip {
  const files: Record<string, Uint8Array> = {};
  let uncompressedBytes = 0;
  for (const [candidate, content] of Object.entries(contents)) {
    const path = normalizeProjectPath(candidate);
    if (path.split('/').includes('.git')) continue;
    const data = typeof content === 'string' ? strToU8(content) : new Uint8Array(content);
    uncompressedBytes += data.byteLength;
    if (uncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
      throw new Error('This project exceeds the 100 MiB browser ZIP export limit. Use a desktop Git client for larger projects.');
    }
    files[path] = data;
  }
  const fileCount = Object.keys(files).length;
  if (fileCount > MAX_ARCHIVE_FILES) {
    throw new Error(`This project has ${fileCount.toLocaleString()} files; the browser export limit is ${MAX_ARCHIVE_FILES.toLocaleString()} files.`);
  }
  return {
    archiveBytes: zipSync(files, {
      level: 6,
      mtime: new Date('1980-01-01T00:00:00.000Z'),
    }),
    fileCount,
    uncompressedBytes,
  };
}

/**
 * Build a downloadable ZIP of the active project files, including binary
 * assets. Dirty buffers are flushed first; Git's internal .git directory is excluded by
 * GitService.listFiles(). The browser holds the uncompressed tree and ZIP in
 * memory, so a conservative cap avoids freezing or exhausting mobile devices.
 */
export async function createProjectArchive(): Promise<ProjectArchive> {
  const projectId = $activeProjectId.get();
  if (!projectId || projectId === 'default') {
    throw new Error('Open or create a project before exporting it.');
  }

  await bufferManager.saveAll();
  const paths = await listFiles();
  const contents: Record<string, Uint8Array> = {};
  for (const candidate of paths) {
    const path = normalizeProjectPath(candidate);
    if (path.split('/').includes('.git')) continue;
    contents[path] = await readFileBytes(path);
  }

  const { archiveBytes, fileCount, uncompressedBytes } = buildProjectZip(contents);
  const project = await db.projects.get(projectId);
  const filename = `${safeFileSlug(project?.name ?? 'devnoder-project')}.zip`;
  const blobBuffer = new ArrayBuffer(archiveBytes.byteLength);
  new Uint8Array(blobBuffer).set(archiveBytes);
  return {
    blob: new Blob([blobBuffer], { type: 'application/zip' }),
    filename,
    fileCount,
    uncompressedBytes,
  };
}
