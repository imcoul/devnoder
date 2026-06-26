// SkillStore.ts — Dexie persistence for user-created skills
import Dexie, { Table } from 'dexie';

export type TriggerType = 'always' | 'keyword' | 'agent' | 'filetype';
export type InjectorType =
  | 'active-file'
  | 'git-status'
  | 'project-structure'
  | 'related-files'
  | 'snippet-library'
  | 'custom';

export interface ContextInjector {
  type: InjectorType;
  n?: number;       // for related-files: top-k chunks
  fn?: string;      // for custom: sandboxed JS function body
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  trigger: TriggerType;
  triggerValue?: string;       // keyword string | agentId | file extension
  systemPromptPrefix: string;  // injected before system prompt
  systemPromptSuffix: string;  // injected after system prompt
  contextInjectors: ContextInjector[];
  mcpServers?: string[];       // server IDs to activate when skill fires
  author: string;
  source: 'builtin' | 'user' | 'community';
  enabled: boolean;
  downloads?: number;
  rating?: number;
  createdAt: number;
}

class SkillDB extends Dexie {
  skills!: Table<Skill>;
  constructor() {
    super('devnoder-skills');
    this.version(1).stores({ skills: 'id, trigger, source, enabled, createdAt' });
  }
}

const db = new SkillDB();

export const skillStore = {
  async getAll(): Promise<Skill[]> {
    return db.skills.orderBy('createdAt').toArray();
  },

  async getEnabled(): Promise<Skill[]> {
    return db.skills.where('enabled').equals(1).toArray();
  },

  async getBySource(source: Skill['source']): Promise<Skill[]> {
    return db.skills.where('source').equals(source).toArray();
  },

  async save(skill: Skill): Promise<void> {
    await db.skills.put(skill);
  },

  async toggle(id: string, enabled: boolean): Promise<void> {
    await db.skills.update(id, { enabled });
  },

  async delete(id: string): Promise<void> {
    await db.skills.delete(id);
  },

  async importFromJSON(json: string): Promise<{ imported: number; skipped: number }> {
    let data: Skill | Skill[];
    try { data = JSON.parse(json); } catch { throw new Error('Invalid .skill.json — must be valid JSON'); }
    const skills = Array.isArray(data) ? data : [data];
    let imported = 0, skipped = 0;
    for (const s of skills) {
      if (!s.name || !s.trigger) { skipped++; continue; }
      const exists = await db.skills.get(s.id);
      if (exists) { skipped++; continue; }
      await db.skills.put({ ...s, source: 'community', enabled: true, createdAt: s.createdAt ?? Date.now() });
      imported++;
    }
    return { imported, skipped };
  },

  async exportToJSON(ids?: string[]): Promise<string> {
    const skills = ids
      ? await db.skills.where('id').anyOf(ids).toArray()
      : await db.skills.where('source').equals('user').toArray();
    return JSON.stringify(skills, null, 2);
  },
};
