import Dexie, { Table } from 'dexie';

export interface FileRecord {
  id?: number;
  path: string;
  content: string;
  language: string;
  updatedAt: number;
  projectId: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  gitRemote?: string;
}

export interface SettingRecord {
  key: string;
  value: string;
}

class DevNoderDB extends Dexie {
  files!: Table<FileRecord>;
  projects!: Table<ProjectRecord>;
  settings!: Table<SettingRecord>;

  constructor() {
    super('devnoder');
    this.version(1).stores({
      files: '++id, path, projectId, updatedAt',
      projects: 'id, name, updatedAt',
      settings: 'key',
    });
  }
}

export const db = new DevNoderDB();

export async function getSetting(key: string, fallback = ''): Promise<string> {
  const rec = await db.settings.get(key);
  return rec?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value });
}
