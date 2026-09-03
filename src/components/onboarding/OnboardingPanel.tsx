import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { projectService } from '../../services/project/ProjectService';
import { templateService, Template } from '../../services/templates/TemplateService';
import { ProjectRecord } from '../../services/storage/db';
import { setPanel } from '../../stores/ui';
import { showToast } from '../../stores/ui';
import './OnboardingPanel.css';

type Mode = 'list' | 'create' | 'template' | 'import';

export default function OnboardingPanel() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('list');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [templates] = useState<Template[]>(() => templateService.list());
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [importToken, setImportToken] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await projectService.listProjects());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const openProject = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await projectService.openProject(id);
      setPanel('code');
    } catch (e: any) {
      setError(e.message ?? 'Failed to open project');
    } finally {
      setBusy(false);
    }
  };

  const createBlank = async () => {
    if (!name.trim()) { setError(t('onboarding.enterName')); return; }
    setBusy(true);
    setError(null);
    try {
      await projectService.createProject(name.trim());
      showToast({ type: 'success', message: `${name.trim()} — ${t('onboarding.create')}` });
      setPanel('code');
    } catch (e: any) {
      setError(e.message ?? t('onboarding.create'));
    } finally {
      setBusy(false);
    }
  };

  const createFromTemplate = async () => {
    if (!name.trim()) { setError(t('onboarding.enterName')); return; }
    if (!selectedTemplate) { setError(t('onboarding.chooseTemplateError')); return; }
    setBusy(true);
    setError(null);
    try {
      await projectService.createProject(name.trim(), { templateId: selectedTemplate });
      showToast({ type: 'success', message: `${name.trim()} — ${t('onboarding.create')}` });
      setPanel('code');
    } catch (e: any) {
      setError(e.message ?? t('onboarding.create'));
    } finally {
      setBusy(false);
    }
  };

  const importRepo = async () => {
    if (!name.trim()) { setError(t('onboarding.enterName')); return; }
    if (!importUrl.trim()) { setError(t('onboarding.enterUrl')); return; }
    setBusy(true);
    setError(null);
    try {
      await projectService.importProject(name.trim(), importUrl.trim(), importToken.trim() || undefined);
      showToast({ type: 'success', message: `${name.trim()} — ${t('onboarding.clone')}` });
      setPanel('code');
    } catch (e: any) {
      setError(e.message ?? t('onboarding.clone'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="onboarding-panel" aria-busy="true">
        <p className="onboarding-loading">{t('onboarding.loading')}</p>
      </div>
    );
  }

  return (
    <div className="onboarding-panel" role="main" aria-label="Project onboarding">
      <div className="onboarding-hero">
        <span className="onboarding-hero__logo" aria-hidden="true">DN</span>
        <h1 className="onboarding-hero__title">
          {projects.length === 0 ? t('onboarding.welcomeTitle') : t('onboarding.yourProjectsTitle')}
        </h1>
        <p className="onboarding-hero__subtitle">
          {projects.length === 0 ? t('onboarding.welcomeSubtitle') : t('onboarding.openSubtitle')}
        </p>
      </div>

      {error && <p className="onboarding-error" role="alert">{error}</p>}

      {projects.length > 0 && mode === 'list' && (
        <ul className="onboarding-project-list" aria-label={t('onboarding.yourProjectsTitle')}>
          {projects.map(p => (
            <li key={p.id} className="onboarding-project-item">
              <button
                type="button"
                className="onboarding-project-item__button"
                onClick={() => openProject(p.id)}
                disabled={busy}
                aria-label={t('onboarding.openProject', { name: p.name })}
              >
                <span className="onboarding-project-item__name">{p.name}</span>
                <span className="onboarding-project-item__meta">
                  {t('onboarding.updated', { date: new Date(p.updatedAt).toLocaleDateString() })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {mode === 'list' && (
        <div className="onboarding-actions" role="group" aria-label={t('onboarding.createBlank')}>
          <button type="button" className="onboarding-action" onClick={() => { setMode('create'); setError(null); }}>
            <span aria-hidden="true">＋</span> {t('onboarding.createBlank')}
          </button>
          <button type="button" className="onboarding-action" onClick={() => { setMode('template'); setError(null); }}>
            <span aria-hidden="true">📦</span> {t('onboarding.startFromTemplate')}
          </button>
          <button type="button" className="onboarding-action" onClick={() => { setMode('import'); setError(null); }}>
            <span aria-hidden="true">⭳</span> {t('onboarding.cloneRepo')}
          </button>
        </div>
      )}

      {mode === 'create' && (
        <form className="onboarding-form" onSubmit={e => { e.preventDefault(); createBlank(); }}>
          <label htmlFor="onboarding-name" className="onboarding-label">{t('onboarding.projectName')}</label>
          <input
            id="onboarding-name"
            className="onboarding-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('onboarding.namePlaceholder')}
            autoFocus
            disabled={busy}
          />
          <div className="onboarding-form-actions">
            <button type="submit" className="onboarding-action onboarding-action--primary" disabled={busy}>
              {busy ? t('onboarding.creating') : t('onboarding.create')}
            </button>
            <button type="button" className="onboarding-action" onClick={() => setMode('list')} disabled={busy}>
              {t('onboarding.cancel')}
            </button>
          </div>
        </form>
      )}

      {mode === 'template' && (
        <form className="onboarding-form" onSubmit={e => { e.preventDefault(); createFromTemplate(); }}>
          <label htmlFor="onboarding-template-name" className="onboarding-label">{t('onboarding.projectName')}</label>
          <input
            id="onboarding-template-name"
            className="onboarding-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('onboarding.namePlaceholder')}
            autoFocus
            disabled={busy}
          />
          <fieldset className="onboarding-template-grid" disabled={busy}>
            <legend className="onboarding-label">{t('onboarding.chooseTemplate')}</legend>
            {templates.map(tpl => (
              <label key={tpl.id} className={`onboarding-template-card ${selectedTemplate === tpl.id ? 'onboarding-template-card--selected' : ''}`}>
                <input
                  type="radio"
                  name="template"
                  value={tpl.id}
                  checked={selectedTemplate === tpl.id}
                  onChange={() => setSelectedTemplate(tpl.id)}
                />
                <span className="onboarding-template-card__icon" aria-hidden="true">{tpl.icon}</span>
                <span className="onboarding-template-card__name">{tpl.name}</span>
                <span className="onboarding-template-card__desc">{tpl.description}</span>
              </label>
            ))}
          </fieldset>
          <div className="onboarding-form-actions">
            <button type="submit" className="onboarding-action onboarding-action--primary" disabled={busy}>
              {busy ? t('onboarding.creating') : t('onboarding.create')}
            </button>
            <button type="button" className="onboarding-action" onClick={() => setMode('list')} disabled={busy}>
              {t('onboarding.cancel')}
            </button>
          </div>
        </form>
      )}

      {mode === 'import' && (
        <form className="onboarding-form" onSubmit={e => { e.preventDefault(); importRepo(); }}>
          <label htmlFor="onboarding-import-name" className="onboarding-label">{t('onboarding.projectName')}</label>
          <input
            id="onboarding-import-name"
            className="onboarding-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('onboarding.namePlaceholder')}
            autoFocus
            disabled={busy}
          />
          <label htmlFor="onboarding-import-url" className="onboarding-label">{t('onboarding.repoUrl')}</label>
          <input
            id="onboarding-import-url"
            className="onboarding-input"
            value={importUrl}
            onChange={e => setImportUrl(e.target.value)}
            placeholder="https://github.com/owner/repo.git"
            disabled={busy}
          />
          <label htmlFor="onboarding-import-token" className="onboarding-label">
            {t('onboarding.accessToken')} <span className="onboarding-label__optional">{t('onboarding.accessTokenOptional')}</span>
          </label>
          <input
            id="onboarding-import-token"
            className="onboarding-input"
            type="password"
            value={importToken}
            onChange={e => setImportToken(e.target.value)}
            placeholder="ghp_…"
            disabled={busy}
            autoComplete="off"
          />
          <div className="onboarding-form-actions">
            <button type="submit" className="onboarding-action onboarding-action--primary" disabled={busy}>
              {busy ? t('onboarding.cloning') : t('onboarding.clone')}
            </button>
            <button type="button" className="onboarding-action" onClick={() => setMode('list')} disabled={busy}>
              {t('onboarding.cancel')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
