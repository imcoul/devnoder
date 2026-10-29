import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { projectService } from '../../services/project/ProjectService';
import { createStarterProject } from '../../services/project/StarterProject';
import { templateService, Template } from '../../services/templates/TemplateService';
import { ProjectRecord } from '../../services/storage/db';
import { setPanel, showToast } from '../../stores/ui';
import { AppIcon } from '../brand/AppIcon';
import { BrandLockup } from '../brand/BrandLockup';
import './OnboardingPanel.css';

type Mode = 'list' | 'starter' | 'create' | 'template' | 'import';
type CapabilityTemplate = Template & { runtimeNote?: string; capability?: string };

function templateCapability(template: CapabilityTemplate) {
  if (template.capability) return template.capability;
  if (template.id === 'vanilla') return 'Runs here';
  return 'Scaffold';
}

export default function OnboardingPanel() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('list');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [templates] = useState<CapabilityTemplate[]>(() => templateService.list() as CapabilityTemplate[]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [importToken, setImportToken] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setProjects(await projectService.listProjects()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Projects could not be loaded.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const openProject = async (id: string) => {
    setBusy(true); setError(null);
    try { await projectService.openProject(id); setPanel('code'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Failed to open project'); }
    finally { setBusy(false); }
  };

  const createStarter = async () => {
    if (!name.trim()) { setError('Enter a project name'); return; }
    setBusy(true); setError(null);
    try {
      await createStarterProject(name);
      showToast({ type: 'success', message: `${name.trim()} — starter project created` });
      setPanel('code');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The starter project could not be created.'); }
    finally { setBusy(false); }
  };

  const createBlank = async () => {
    if (!name.trim()) { setError(t('onboarding.enterName')); return; }
    setBusy(true); setError(null);
    try { await projectService.createProject(name.trim()); showToast({ type: 'success', message: `${name.trim()} — ${t('onboarding.create')}` }); setPanel('code'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('onboarding.create')); }
    finally { setBusy(false); }
  };

  const createFromTemplate = async () => {
    if (!name.trim()) { setError(t('onboarding.enterName')); return; }
    if (!selectedTemplate) { setError(t('onboarding.chooseTemplateError')); return; }
    setBusy(true); setError(null);
    try { await projectService.createProject(name.trim(), { templateId: selectedTemplate }); showToast({ type: 'success', message: `${name.trim()} — ${t('onboarding.create')}` }); setPanel('code'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('onboarding.create')); }
    finally { setBusy(false); }
  };

  const importRepo = async () => {
    if (!name.trim()) { setError(t('onboarding.enterName')); return; }
    if (!importUrl.trim()) { setError(t('onboarding.enterUrl')); return; }
    setBusy(true); setError(null);
    try { await projectService.importProject(name.trim(), importUrl.trim(), importToken.trim() || undefined); showToast({ type: 'success', message: `${name.trim()} — ${t('onboarding.clone')}` }); setPanel('code'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('onboarding.clone')); }
    finally { setBusy(false); }
  };

  const chooseMode = (next: Mode) => { setMode(next); setError(null); if (next === 'starter' && !name) setName('my-web-project'); };

  if (loading) return <div className="onboarding-panel" aria-busy="true"><p className="onboarding-loading">{t('onboarding.loading')}</p></div>;

  return (
    <div className="onboarding-panel" role="main" aria-label="Project onboarding">
      <section className="onboarding-intro">
        <BrandLockup />
        <p className="onboarding-kicker">Local-first workspace · by Srvel</p>
        <h1>{projects.length === 0 ? t('onboarding.welcomeTitle') : t('onboarding.yourProjectsTitle')}</h1>
        <p>{projects.length === 0 ? 'Build something useful, wherever you work.' : t('onboarding.openSubtitle')}</p>
        <div className="onboarding-boundary"><span className="onboarding-boundary__dot" aria-hidden="true" />Your files stay in this browser. Export a backup before clearing storage.</div>
      </section>
      <section className="onboarding-workbench" aria-label="Create or open a project">
        {error && <p className="onboarding-error" role="alert">{error}</p>}
        {projects.length > 0 && mode === 'list' && <ul className="onboarding-project-list" aria-label={t('onboarding.yourProjectsTitle')}>
          {projects.map(project => <li key={project.id}><button type="button" className="onboarding-project-item" onClick={() => void openProject(project.id)} disabled={busy} aria-label={t('onboarding.openProject', { name: project.name })}><span>{project.name}</span><small>{t('onboarding.updated', { date: new Date(project.updatedAt).toLocaleDateString() })}</small><AppIcon name="chevron" size={16} /></button></li>)}
        </ul>}
        {mode === 'list' && <div className="onboarding-actions" role="group" aria-label="Start a project">
          <button type="button" className="onboarding-action onboarding-action--starter" onClick={() => chooseMode('starter')}><span><AppIcon name="code" size={20} /><strong>Create web project</strong><small>HTML, CSS and classic JavaScript · runs here</small></span><AppIcon name="chevron" size={18} /></button>
          <button type="button" className="onboarding-action" onClick={() => chooseMode('create')}><AppIcon name="plus" size={19} /><span>{t('onboarding.createBlank')}<small>Start with an empty browser-local repo</small></span></button>
          <div className="onboarding-secondary-actions"><button type="button" className="onboarding-action" onClick={() => chooseMode('template')}><AppIcon name="file" size={18} /><span>{t('onboarding.startFromTemplate')}</span></button><button type="button" className="onboarding-action" onClick={() => chooseMode('import')}><AppIcon name="download" size={18} /><span>{t('onboarding.cloneRepo')}</span></button></div>
        </div>}
        {mode === 'starter' && <form className="onboarding-form" onSubmit={event => { event.preventDefault(); void createStarter(); }}><div className="onboarding-form-heading"><AppIcon name="code" size={20} /><div><h2>Create web project</h2><p>Three small files, ready to edit and preview.</p></div></div><label htmlFor="onboarding-starter-name">{t('onboarding.projectName')}</label><input id="onboarding-starter-name" className="onboarding-input" value={name} onChange={event => setName(event.target.value)} autoFocus disabled={busy} /><div className="onboarding-form-actions"><button type="submit" className="onboarding-action onboarding-action--primary" disabled={busy}>{busy ? 'Creating…' : 'Create and open index.html'}</button><button type="button" className="onboarding-action" onClick={() => setMode('list')} disabled={busy}>{t('onboarding.cancel')}</button></div></form>}
        {mode === 'create' && <form className="onboarding-form" onSubmit={event => { event.preventDefault(); void createBlank(); }}><label htmlFor="onboarding-name">{t('onboarding.projectName')}</label><input id="onboarding-name" className="onboarding-input" value={name} onChange={event => setName(event.target.value)} placeholder={t('onboarding.namePlaceholder')} autoFocus disabled={busy} /><div className="onboarding-form-actions"><button type="submit" className="onboarding-action onboarding-action--primary" disabled={busy}>{busy ? t('onboarding.creating') : t('onboarding.create')}</button><button type="button" className="onboarding-action" onClick={() => setMode('list')} disabled={busy}>{t('onboarding.cancel')}</button></div></form>}
        {mode === 'template' && <form className="onboarding-form" onSubmit={event => { event.preventDefault(); void createFromTemplate(); }}><div className="template-intro"><strong>Choose how this project runs before you create it.</strong><span>Runs here is browser preview. Scaffold means an external toolchain is required.</span></div><label htmlFor="onboarding-template-name">{t('onboarding.projectName')}</label><input id="onboarding-template-name" className="onboarding-input" value={name} onChange={event => setName(event.target.value)} placeholder={t('onboarding.namePlaceholder')} autoFocus disabled={busy} /><fieldset className="onboarding-template-grid" disabled={busy}><legend>{t('onboarding.chooseTemplate')}</legend>{templates.map(template => <label key={template.id} className={`onboarding-template-card ${selectedTemplate === template.id ? 'onboarding-template-card--selected' : ''}`}><input type="radio" name="template" value={template.id} checked={selectedTemplate === template.id} onChange={() => setSelectedTemplate(template.id)} /><span className={`template-badge template-badge--${templateCapability(template) === 'Runs here' ? 'local' : 'scaffold'}`}>{templateCapability(template)}</span><span className="onboarding-template-card__name">{template.name}</span><span className="onboarding-template-card__desc">{template.runtimeNote ?? template.description}</span></label>)}</fieldset><div className="onboarding-form-actions"><button type="submit" className="onboarding-action onboarding-action--primary" disabled={busy}>{busy ? t('onboarding.creating') : t('onboarding.create')}</button><button type="button" className="onboarding-action" onClick={() => setMode('list')} disabled={busy}>{t('onboarding.cancel')}</button></div></form>}
        {mode === 'import' && <form className="onboarding-form" onSubmit={event => { event.preventDefault(); void importRepo(); }}><label htmlFor="onboarding-import-name">{t('onboarding.projectName')}</label><input id="onboarding-import-name" className="onboarding-input" value={name} onChange={event => setName(event.target.value)} placeholder={t('onboarding.namePlaceholder')} autoFocus disabled={busy} /><label htmlFor="onboarding-import-url">{t('onboarding.repoUrl')}</label><input id="onboarding-import-url" className="onboarding-input" value={importUrl} onChange={event => setImportUrl(event.target.value)} placeholder="https://github.com/owner/repo.git" disabled={busy} /><label htmlFor="onboarding-import-token">{t('onboarding.accessToken')} <span>{t('onboarding.accessTokenOptional')}</span></label><input id="onboarding-import-token" className="onboarding-input" type="password" value={importToken} onChange={event => setImportToken(event.target.value)} placeholder="ghp_…" disabled={busy} autoComplete="off" /><div className="onboarding-form-actions"><button type="submit" className="onboarding-action onboarding-action--primary" disabled={busy}>{busy ? t('onboarding.cloning') : t('onboarding.clone')}</button><button type="button" className="onboarding-action" onClick={() => setMode('list')} disabled={busy}>{t('onboarding.cancel')}</button></div></form>}
      </section>
    </div>
  );
}
