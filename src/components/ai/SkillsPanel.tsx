import React, { useState, useEffect, useCallback, useRef } from 'react';
import { skillStore, Skill, TriggerType, ContextInjector, InjectorType } from '../../services/ai/SkillStore';
import { skillsEngine } from '../../services/ai/SkillsEngine';
import { AGENTS, AgentId } from '../../services/ai/AIAgents';
import { showToast } from '../../stores/ui';
import { useStore } from '@nanostores/react';
import { $activeBuffer, $buffers } from '../../services/editor/BufferManager';
import './SkillsPanel.css';

type Tab = 'mine' | 'builder' | 'community';

const TRIGGER_LABELS: Record<TriggerType, string> = {
  always: 'Always (every request)',
  keyword: 'Keyword in message',
  agent: 'Specific agent',
  filetype: 'File extension',
};

const INJECTOR_LABELS: Record<InjectorType, string> = {
  'active-file':       '📄 Active file content',
  'git-status':        '🔀 Git status / diff',
  'project-structure': '🗂 Project file tree',
  'related-files':     '🔍 Related files (RAG)',
  'snippet-library':   '📋 My snippet library',
  'custom':            '⚙ Custom JS injector',
};

const SOURCE_COLORS: Record<Skill['source'], string> = {
  builtin:   'var(--color-turquoise)',
  user:      'var(--color-yellow)',
  community: 'var(--color-purple)',
};

// Community registry — fetches from CF Worker / D1, falls back to built-in seed
const SKILLS_REGISTRY_URL = 'https://devnoder-executor.srvel-build.workers.dev/skills';

const COMMUNITY_SKILLS_SEED: Skill[] = [
  {
    id: 'community-react-perf', name: 'React Performance', description: 'Suggests memo, useCallback, useMemo before every component',
    icon: '⚛️', trigger: 'filetype', triggerValue: 'tsx',
    systemPromptPrefix: 'Before writing any React component, consider: memo(), useCallback(), useMemo(), lazy(). Prefer derived state over useState. Avoid inline functions in JSX.',
    systemPromptSuffix: '', contextInjectors: [], author: 'community', source: 'community',
    enabled: true, downloads: 312, rating: 4.6, createdAt: Date.now() - 86400000 * 7,
  },
  {
    id: 'community-a11y-audit', name: 'Accessibility Audit', description: 'WCAG 2.1 AA compliance reminder for every HTML/JSX output',
    icon: '♿', trigger: 'keyword', triggerValue: 'html',
    systemPromptPrefix: 'WCAG 2.1 AA requirements: alt on all images, labels on all inputs, heading hierarchy h1→h2→h3, sufficient color contrast (4.5:1 text, 3:1 UI), keyboard navigation, aria-* attributes where needed.',
    systemPromptSuffix: '', contextInjectors: [], author: 'community', source: 'community',
    enabled: true, downloads: 208, rating: 4.8, createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'community-python-type', name: 'Python Type Hints', description: 'Enforces Python 3.12+ type annotations everywhere',
    icon: '🐍', trigger: 'filetype', triggerValue: 'py',
    systemPromptPrefix: 'Enforce Python 3.12+ type hints: all function parameters and returns annotated, use list/dict/tuple (not List/Dict/Tuple from typing), prefer X | None over Optional[X], use TypeAlias, Final, TypeVar as appropriate.',
    systemPromptSuffix: '', contextInjectors: [], author: 'community', source: 'community',
    enabled: true, downloads: 445, rating: 4.5, createdAt: Date.now() - 86400000 * 14,
  },
];

async function fetchCommunitySkills(): Promise<Skill[]> {
  try {
    const res = await fetch(SKILLS_REGISTRY_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : COMMUNITY_SKILLS_SEED;
  } catch {
    // Offline or worker not deployed — use seed data
    return COMMUNITY_SKILLS_SEED;
  }
}

function SkillRow({ skill, onToggle, onEdit, onDelete }: {
  skill: Skill;
  onToggle: (id: string, v: boolean) => void;
  onEdit: (skill: Skill) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="skill-row">
      <span className="skill-icon">{skill.icon}</span>
      <div className="skill-info">
        <div className="skill-name">
          {skill.name}
          <span className="skill-source-badge" style={{ color: SOURCE_COLORS[skill.source] }}>
            {skill.source}
          </span>
        </div>
        <div className="skill-desc">{skill.description}</div>
        <div className="skill-meta">
          <span className="skill-trigger">{TRIGGER_LABELS[skill.trigger]}</span>
          {skill.triggerValue && <span className="skill-trigger-val">: {skill.triggerValue}</span>}
        </div>
      </div>
      <div className="skill-actions">
        {skill.source !== 'builtin' && (
          <button className="skill-edit-btn" onClick={() => onEdit(skill)}>✏</button>
        )}
        {skill.source !== 'builtin' && (
          <button className="skill-del-btn" onClick={() => onDelete(skill.id)}>✕</button>
        )}
        <label className="skill-toggle">
          <input type="checkbox" checked={skill.enabled}
            onChange={e => onToggle(skill.id, e.target.checked)} />
          <span className="skill-toggle-track" />
        </label>
      </div>
    </div>
  );
}

const BLANK_SKILL: Omit<Skill, 'id' | 'createdAt' | 'source'> = {
  name: '', description: '', icon: '⚡', trigger: 'always',
  triggerValue: '', systemPromptPrefix: '', systemPromptSuffix: '',
  contextInjectors: [], author: '', enabled: true,
};

export default function SkillsPanel() {
  const [tab, setTab]           = useState<Tab>('mine');
  const [skills, setSkills]     = useState<Skill[]>([]);
  const [editing, setEditing]   = useState<Partial<Skill> | null>(null);
  const [communitySkills, setCommunitySkills] = useState<Skill[]>(COMMUNITY_SKILLS_SEED);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [preview, setPreview]   = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeId  = useStore($activeBuffer);
  const buffers   = useStore($buffers);
  const activeBuf = buffers.find(b => b.id === activeId);

  const load = useCallback(async () => {
    setSkills(await skillStore.getAll());
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab === 'community') {
      setCommunityLoading(true);
      fetchCommunitySkills()
        .then(setCommunitySkills)
        .finally(() => setCommunityLoading(false));
    }
  }, [tab]);

  const toggle = async (id: string, enabled: boolean) => {
    await skillStore.toggle(id, enabled);
    load();
  };

  const remove = async (id: string) => {
    await skillStore.delete(id);
    load();
    showToast({ type: 'info', message: 'Skill removed' });
  };

  const save = async () => {
    if (!editing?.name) { showToast({ type: 'error', message: 'Skill name required' }); return; }
    const skill: Skill = {
      id: editing.id ?? crypto.randomUUID(),
      name: editing.name!,
      description: editing.description ?? '',
      icon: editing.icon ?? '⚡',
      trigger: editing.trigger ?? 'always',
      triggerValue: editing.triggerValue,
      systemPromptPrefix: editing.systemPromptPrefix ?? '',
      systemPromptSuffix: editing.systemPromptSuffix ?? '',
      contextInjectors: editing.contextInjectors ?? [],
      author: editing.author ?? 'user',
      source: editing.source === 'builtin' ? 'builtin' : 'user',
      enabled: editing.enabled ?? true,
      createdAt: editing.createdAt ?? Date.now(),
    };
    await skillStore.save(skill);
    setEditing(null);
    load();
    showToast({ type: 'success', message: `Skill "${skill.name}" saved` });
  };

  const testSkill = async () => {
    if (!editing) return;
    const skill = editing as Skill;
    setPreviewing(true);
    try {
      const result = await skillsEngine.preview(skill, {
        agentId: 'code',
        language: activeBuf?.language ?? 'typescript',
        userMessage: 'Test message for skill preview',
        activeFileContent: activeBuf?.content,
        activeFilePath: activeBuf?.path,
      });
      setPreview(result);
    } catch (e: any) {
      setPreview(`Error: ${e.message}`);
    } finally {
      setPreviewing(false);
    }
  };

  const importFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const { imported, skipped } = await skillStore.importFromJSON(text);
      load();
      showToast({ type: 'success', message: `Imported ${imported} skill(s), skipped ${skipped}` });
    } catch (err: any) {
      showToast({ type: 'error', message: err.message });
    }
    e.target.value = '';
  };

  const exportSkills = async () => {
    const json = await skillStore.exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'devnoder-skills.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const installCommunity = async (skill: Skill) => {
    await skillStore.save({ ...skill, enabled: true });
    load();
    showToast({ type: 'success', message: `"${skill.name}" installed` });
  };

  const toggleInjector = (type: InjectorType) => {
    const current = editing?.contextInjectors ?? [];
    const exists  = current.some(i => i.type === type);
    const next: ContextInjector[] = exists
      ? current.filter(i => i.type !== type)
      : [...current, { type, ...(type === 'related-files' ? { n: 5 } : {}) }];
    setEditing(e => e ? { ...e, contextInjectors: next } : e);
  };

  return (
    <div className="skills-panel">
      <div className="skills-header">
        <span className="skills-title">⚡ Skills</span>
        <div className="skills-header-actions">
          <button className="skills-ghost-btn" onClick={exportSkills}>Export</button>
          <button className="skills-ghost-btn" onClick={() => fileRef.current?.click()}>Import</button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={importFile} />
        </div>
      </div>

      <div className="skills-tabs">
        {(['mine', 'builder', 'community'] as Tab[]).map(t => (
          <button key={t} className={`skills-tab ${tab === t ? 'active' : ''}`}
            onClick={() => { setTab(t); if (t === 'builder' && !editing) setEditing({ ...BLANK_SKILL }); }}>
            {t === 'mine' ? `My Skills (${skills.length})`
              : t === 'builder' ? '+ Builder'
              : `Community (${COMMUNITY_SKILLS.length})`}
          </button>
        ))}
      </div>

      {/* ── My Skills ── */}
      {tab === 'mine' && (
        <div className="skills-body">
          {skills.length === 0 && (
            <div className="skills-empty">
              <span>⚡</span>
              <p>No skills yet</p>
              <button className="skills-ghost-btn" onClick={() => { setTab('builder'); setEditing({ ...BLANK_SKILL }); }}>
                Create your first skill
              </button>
            </div>
          )}
          {skills.map(s => (
            <SkillRow key={s.id} skill={s}
              onToggle={toggle} onDelete={remove}
              onEdit={s => { setEditing(s); setTab('builder'); }} />
          ))}
        </div>
      )}

      {/* ── Builder ── */}
      {tab === 'builder' && editing && (
        <div className="skills-body skills-builder">
          <div className="builder-row">
            <input className="builder-icon" value={editing.icon ?? ''} maxLength={2}
              onChange={e => setEditing(ed => ed ? { ...ed, icon: e.target.value } : ed)} />
            <input className="builder-name" placeholder="Skill name"
              value={editing.name ?? ''}
              onChange={e => setEditing(ed => ed ? { ...ed, name: e.target.value } : ed)} />
          </div>

          <textarea className="builder-desc" placeholder="Description (one line)"
            value={editing.description ?? ''} rows={2}
            onChange={e => setEditing(ed => ed ? { ...ed, description: e.target.value } : ed)} />

          <div className="builder-field">
            <label>Trigger</label>
            <select className="builder-select" value={editing.trigger ?? 'always'}
              onChange={e => setEditing(ed => ed ? { ...ed, trigger: e.target.value as TriggerType } : ed)}>
              {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {editing.trigger !== 'always' && (
            <div className="builder-field">
              <label>
                {editing.trigger === 'keyword' ? 'Keyword' :
                  editing.trigger === 'agent' ? 'Agent' : 'File extension'}
              </label>
              {editing.trigger === 'agent' ? (
                <select className="builder-select" value={editing.triggerValue ?? ''}
                  onChange={e => setEditing(ed => ed ? { ...ed, triggerValue: e.target.value } : ed)}>
                  <option value="">Select agent…</option>
                  {AGENTS.map(a => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
                </select>
              ) : (
                <input className="builder-input"
                  placeholder={editing.trigger === 'keyword' ? 'component' : 'tsx'}
                  value={editing.triggerValue ?? ''}
                  onChange={e => setEditing(ed => ed ? { ...ed, triggerValue: e.target.value } : ed)} />
              )}
            </div>
          )}

          <div className="builder-field">
            <label>System prompt prefix</label>
            <textarea className="builder-textarea" rows={4}
              placeholder="Injected before the system prompt…"
              value={editing.systemPromptPrefix ?? ''}
              onChange={e => setEditing(ed => ed ? { ...ed, systemPromptPrefix: e.target.value } : ed)} />
          </div>

          <div className="builder-field">
            <label>System prompt suffix</label>
            <textarea className="builder-textarea" rows={2}
              placeholder="Injected after the system prompt…"
              value={editing.systemPromptSuffix ?? ''}
              onChange={e => setEditing(ed => ed ? { ...ed, systemPromptSuffix: e.target.value } : ed)} />
          </div>

          <div className="builder-field">
            <label>Context injectors</label>
            <div className="builder-injectors">
              {(Object.keys(INJECTOR_LABELS) as InjectorType[]).map(type => {
                const active = editing.contextInjectors?.some(i => i.type === type);
                return (
                  <label key={type} className={`injector-chip ${active ? 'active' : ''}`}>
                    <input type="checkbox" checked={!!active} onChange={() => toggleInjector(type)} />
                    {INJECTOR_LABELS[type]}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="builder-actions">
            <button className="builder-test-btn" onClick={testSkill} disabled={previewing}>
              {previewing ? 'Testing…' : '🔍 Test skill'}
            </button>
            <button className="builder-cancel-btn" onClick={() => { setEditing(null); setTab('mine'); }}>
              Cancel
            </button>
            <button className="builder-save-btn" onClick={save}>Save skill</button>
          </div>

          {preview && (
            <div className="builder-preview">
              <div className="builder-preview-head">
                <span>Resolved prompt preview</span>
                <button onClick={() => setPreview(null)}>×</button>
              </div>
              <pre className="builder-preview-content">{preview}</pre>
            </div>
          )}
        </div>
      )}

      {/* ── Community ── */}
      {tab === 'community' && (
        <div className="skills-body">
          {communityLoading && (
            <div className="skills-empty" style={{paddingBlock:'1rem'}}>
              <div style={{width:'1.2rem',height:'1.2rem',border:'2px solid var(--color-border)',borderTopColor:'var(--color-turquoise)',borderRadius:'50%',animation:'spin 0.7s linear infinite'}} />
              <p style={{fontSize:'0.78rem'}}>Loading from registry…</p>
            </div>
          )}
          {!communityLoading && communitySkills.length === 0 && (
            <div className="skills-empty"><span>🌐</span><p>No community skills available</p></div>
          )}
          {communitySkills.map(skill => {
            const installed = skills.some(s => s.id === skill.id);
            return (
              <div key={skill.id} className="skill-row">
                <span className="skill-icon">{skill.icon}</span>
                <div className="skill-info">
                  <div className="skill-name">
                    {skill.name}
                    <span className="skill-rating">{'★'.repeat(Math.round(skill.rating ?? 0))}</span>
                    <span className="skill-downloads">{skill.downloads} installs</span>
                  </div>
                  <div className="skill-desc">{skill.description}</div>
                  <div className="skill-meta">
                    <span className="skill-trigger">{TRIGGER_LABELS[skill.trigger]}</span>
                    {skill.triggerValue && <span className="skill-trigger-val">: {skill.triggerValue}</span>}
                  </div>
                </div>
                <button className="skill-install-btn" onClick={() => installCommunity(skill)} disabled={installed}>
                  {installed ? '✓ Installed' : 'Install'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
