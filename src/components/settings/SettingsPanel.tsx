import React, { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { useTranslation } from 'react-i18next';
import { $theme, $lang, $ui, ThemeId, Lang } from '../../stores/ui';
import { subscriptionService, PLANS, Tier } from '../../services/revenue/SubscriptionService';
import { audioCueService, CueConfig } from '../../services/accessibility/AudioCueService';
import { aiGateway } from '../../services/ai/AIGateway';
import './SettingsPanel.css';

const THEMES: Array<{ id: ThemeId; label: string }> = [
  { id: 'default',      label: 'Default (Dark)' },
  { id: 'light',        label: 'Light' },
  { id: 'protanopia',   label: 'Protanopia' },
  { id: 'deuteranopia', label: 'Deuteranopia' },
  { id: 'tritanopia',   label: 'Tritanopia' },
  { id: 'hc-aaa',       label: 'High Contrast AAA' },
  { id: 'hc-light',     label: 'High Contrast Light' },
  { id: 'grayscale',    label: 'Grayscale' },
];

const LANGS: Array<{ id: Lang; label: string; dir: 'ltr' | 'rtl' }> = [
  { id: 'en', label: 'English', dir: 'ltr' },
  { id: 'fr', label: 'Français', dir: 'ltr' },
  { id: 'ar', label: 'العربية', dir: 'rtl' },
];

type Section = 'appearance' | 'editor' | 'ai' | 'subscription' | 'accessibility' | 'about';

export default function SettingsPanel() {
  const { t, i18n } = useTranslation();
  const theme = useStore($theme);
  const lang  = useStore($lang);
  const ui    = useStore($ui);

  const [section, setSection] = useState<Section>('appearance');
  const [tier, setTier]       = useState<Tier>('free');
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseMsg, setLicenseMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [keys, setKeys]       = useState({ groq: '', openai: '', anthropic: '', openrouter: '' });
  const [saved, setSaved]     = useState(false);
  const [customModelUrl, setCustomModelUrl] = useState('');
  const [customModelLabel, setCustomModelLabel] = useState('');
  const [addingModel, setAddingModel] = useState(false);

  useEffect(() => {
    subscriptionService.load();
    setTier(subscriptionService.getTier());
    aiGateway.loadKeys();
    // Load stored key labels (not actual keys for security)
    const providers = ['groq', 'openai', 'anthropic', 'openrouter'];
    const loaded: any = {};
    providers.forEach(p => {
      loaded[p] = localStorage.getItem(`devnoder-key-${p}`) ? '••••••••' : '';
    });
    setKeys(loaded);
  }, []);

  const setTheme = (id: ThemeId) => {
    $theme.set(id);
    localStorage.setItem('devnoder-theme', id);
  };

  const setLanguage = (id: Lang) => {
    $lang.set(id);
    i18n.changeLanguage(id);
    document.documentElement.lang = id;
    document.documentElement.dir = LANGS.find(l => l.id === id)?.dir ?? 'ltr';
    localStorage.setItem('devnoder-lang', id);
  };

  const saveEditorSettings = () => {
    localStorage.setItem('devnoder-ui', JSON.stringify($ui.get()));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const saveApiKey = (provider: string, value: string) => {
    if (value && !value.startsWith('•')) {
      aiGateway.setKey(provider as any, value);
    }
  };

  const addCustomModel = async () => {
    if (!customModelUrl.trim() || !customModelLabel.trim()) {
      showToast({ type: 'error', message: 'Both URL and label are required' });
      return;
    }
    setAddingModel(true);
    try {
      const { webLLMManager } = await import('../../services/ai/WebLLMManager');
      await webLLMManager.addCustomModel(customModelUrl.trim(), customModelLabel.trim());
      setCustomModelUrl(''); setCustomModelLabel('');
      showToast({ type: 'success', message: `Custom model "${customModelLabel}" added — select it in the AI panel` });
    } catch (e: any) {
      showToast({ type: 'error', message: e.message });
    } finally { setAddingModel(false); }
  };

  const activateLicense = async () => {
    const result = await subscriptionService.activateLicense(licenseKey.trim());
    setLicenseMsg({ ok: result.success, text: result.message });
    if (result.success) setTier(result.tier);
  };

  const deactivate = () => {
    subscriptionService.deactivate();
    setTier('free');
    setLicenseMsg({ ok: true, text: 'Deactivated — back to Free plan.' });
  };

  const [audioCfg, setAudioCfg] = useState<CueConfig>(() => audioCueService.getConfig());

  const updateAudio = (patch: Partial<CueConfig>) => {
    audioCueService.updateConfig(patch);
    setAudioCfg(audioCueService.getConfig());
  };

  const SECTIONS: Array<{ id: Section; label: string; icon: string }> = [
    { id: 'appearance',   label: 'Appearance',    icon: '🎨' },
    { id: 'editor',       label: 'Editor',         icon: '💻' },
    { id: 'ai',           label: 'AI & API Keys',  icon: '🤖' },
    { id: 'subscription', label: 'Subscription',   icon: '⭐' },
    { id: 'about',        label: 'About',           icon: 'ℹ' },
  ];

  return (
    <div className="settings-panel">
      <div className="settings-nav">
        {SECTIONS.map(s => (
          <button key={s.id} className={`settings-nav-btn ${section === s.id ? 'active' : ''}`}
            onClick={() => setSection(s.id)}>
            <span className="settings-nav-icon">{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      <div className="settings-content">

        {/* ── Appearance ── */}
        {section === 'appearance' && (
          <div className="settings-section">
            <h2 className="settings-section-title">Appearance</h2>

            <div className="settings-group">
              <div className="settings-group-label">Theme</div>
              <div className="theme-grid">
                {THEMES.map(t => (
                  <button key={t.id} className={`theme-btn ${theme === t.id ? 'active' : ''}`}
                    onClick={() => setTheme(t.id)} data-theme={t.id}>
                    <span className="theme-btn-swatch" />
                    <span className="theme-btn-label">{t.label}</span>
                    {theme === t.id && <span className="theme-btn-check">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-group-label">Language</div>
              <div className="lang-options">
                {LANGS.map(l => (
                  <button key={l.id} className={`lang-btn ${lang === l.id ? 'active' : ''}`}
                    onClick={() => setLanguage(l.id)} dir={l.dir}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Editor ── */}
        {section === 'editor' && (
          <div className="settings-section">
            <h2 className="settings-section-title">Editor</h2>
            <div className="settings-group">
              <label className="settings-field">
                <span>Font size</span>
                <div className="settings-field-row">
                  <input type="range" min={10} max={24} value={ui.fontSize}
                    onChange={e => $ui.setKey('fontSize', Number(e.target.value))} />
                  <span className="settings-field-val">{ui.fontSize}px</span>
                </div>
              </label>
              <label className="settings-field">
                <span>Tab size</span>
                <select className="settings-select" value={ui.tabSize}
                  onChange={e => $ui.setKey('tabSize', Number(e.target.value))}>
                  {[2, 4, 8].map(n => <option key={n} value={n}>{n} spaces</option>)}
                </select>
              </label>
              <label className="settings-field settings-field--row">
                <span>Word wrap</span>
                <input type="checkbox" checked={ui.wordWrap}
                  onChange={e => $ui.setKey('wordWrap', e.target.checked)} />
              </label>
            </div>
            <button className="settings-save-btn" onClick={saveEditorSettings}>
              {saved ? '✓ Saved' : 'Save Editor Settings'}
            </button>
          </div>
        )}

        {/* ── AI & API Keys ── */}
        {section === 'ai' && (
          <div className="settings-section">
            <h2 className="settings-section-title">AI & API Keys</h2>
            <p className="settings-desc">Keys are stored locally and never leave your device except to contact the provider directly.</p>
            {[
              { id: 'groq', label: 'Groq', link: 'https://console.groq.com', hint: 'Free — Llama, Mixtral, Gemma' },
              { id: 'openai', label: 'OpenAI', link: 'https://platform.openai.com', hint: 'GPT-4o, GPT-4o Mini' },
              { id: 'anthropic', label: 'Anthropic', link: 'https://console.anthropic.com', hint: 'Claude Sonnet & Haiku' },
              { id: 'openrouter', label: 'OpenRouter', link: 'https://openrouter.ai', hint: 'Free DeepSeek, Llama models' },
            ].map(({ id, label, link, hint }) => (
              <div key={id} className="settings-group">
                <label className="settings-field">
                  <span><a href={link} target="_blank" rel="noopener noreferrer">{label}</a> <span className="settings-hint">{hint}</span></span>
                  <div className="settings-field-row">
                    <input type="password" className="settings-input" placeholder="Paste API key…"
                      value={keys[id as keyof typeof keys]}
                      onChange={e => setKeys(k => ({ ...k, [id]: e.target.value }))}
                      onBlur={e => saveApiKey(id, e.target.value)} />
                  </div>
                </label>
              </div>
            ))}
          </div>
        )}

        {/* ── Subscription ── */}
        {section === 'subscription' && (
          <div className="settings-section">
            <h2 className="settings-section-title">Subscription</h2>

            <div className={`current-plan-card plan-card--${tier}`}>
              <div className="plan-card-tier">{subscriptionService.getPlan().name}</div>
              <div className="plan-card-price">{subscriptionService.getPlan().price}</div>
              {tier !== 'free' && subscriptionService.daysRemaining() !== null && (
                <div className="plan-card-expiry">{subscriptionService.daysRemaining()} days remaining</div>
              )}
            </div>

            {tier !== 'free' && (
              <button className="settings-danger-btn" onClick={deactivate}>Deactivate License</button>
            )}

            {tier === 'free' && (
              <div className="license-activate">
                <div className="settings-group-label">Have a license key?</div>
                <div className="settings-field-row">
                  <input className="settings-input" value={licenseKey} placeholder="PRO-XXXX-XXXX-XXXX"
                    onChange={e => setLicenseKey(e.target.value)} />
                  <button className="settings-save-btn" onClick={activateLicense}>Activate</button>
                </div>
                {licenseMsg && (
                  <p className={`license-msg ${licenseMsg.ok ? 'license-msg--ok' : 'license-msg--err'}`}>
                    {licenseMsg.text}
                  </p>
                )}
              </div>
            )}

            <div className="plan-grid">
              {PLANS.map(plan => (
                <div key={plan.id} className={`plan-option ${tier === plan.id ? 'plan-option--current' : ''}`}>
                  <div className="plan-option-name">{plan.name}</div>
                  <div className="plan-option-price">{plan.price}</div>
                  <ul className="plan-features">
                    {plan.features.slice(0, 6).map((f, i) => (
                      <li key={i}><span className="plan-check">✓</span> {f}</li>
                    ))}
                    {plan.features.length > 6 && (
                      <li className="plan-more">+{plan.features.length - 6} more</li>
                    )}
                  </ul>
                  {tier !== plan.id && plan.id !== 'free' && (
                    <a className="plan-upgrade-btn"
                      href="https://srvel.io/devnoder/pricing" target="_blank" rel="noopener noreferrer">
                      Upgrade →
                    </a>
                  )}
                  {tier === plan.id && <span className="plan-current-badge">Current plan</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Accessibility / Audio Cues ── */}
        {section === 'accessibility' && (
          <div className="settings-section">
            <h2 className="settings-section-title">Accessibility</h2>
            <p className="settings-desc">
              Audio cues provide spoken and tonal feedback for eyes-free coding.
              Screen reader compatible — uses Web Speech API + AudioContext.
            </p>

            <div className="settings-group">
              <label className="settings-field settings-field--row">
                <span>Enable audio cues</span>
                <input type="checkbox" checked={audioCfg.enabled}
                  onChange={e => updateAudio({ enabled: e.target.checked })} />
              </label>

              {audioCfg.enabled && (
                <>
                  <label className="settings-field settings-field--row">
                    <span>Speech announcements</span>
                    <input type="checkbox" checked={audioCfg.speechEnabled}
                      onChange={e => updateAudio({ speechEnabled: e.target.checked })} />
                  </label>
                  <label className="settings-field settings-field--row">
                    <span>Tone cues</span>
                    <input type="checkbox" checked={audioCfg.tonesEnabled}
                      onChange={e => updateAudio({ tonesEnabled: e.target.checked })} />
                  </label>
                  <label className="settings-field">
                    <span>Volume</span>
                    <div className="settings-field-row">
                      <input type="range" min={0} max={1} step={0.05}
                        value={audioCfg.volume}
                        onChange={e => updateAudio({ volume: parseFloat(e.target.value) })} />
                      <span className="settings-field-val">{Math.round(audioCfg.volume * 100)}%</span>
                    </div>
                  </label>
                  <label className="settings-field">
                    <span>Speech rate</span>
                    <div className="settings-field-row">
                      <input type="range" min={0.5} max={2} step={0.1}
                        value={audioCfg.speechRate}
                        onChange={e => updateAudio({ speechRate: parseFloat(e.target.value) })} />
                      <span className="settings-field-val">{audioCfg.speechRate}×</span>
                    </div>
                  </label>
                  <div className="settings-group">
                    <div className="settings-group-label">Test</div>
                    <div style={{display:'flex',gap:'0.4rem',flexWrap:'wrap'}}>
                      {(['file-saved','ai-done','commit-success','error-detected','secret-detected'] as const).map(ev => (
                        <button key={ev} className="settings-save-btn" style={{fontSize:'0.72rem',padding:'0.2rem 0.5rem'}}
                          onClick={() => audioCueService.cue(ev)}>
                          {ev.replace(/-/g,' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── About ── */}
        {section === 'about' && (
          <div className="settings-section">
            <h2 className="settings-section-title">About DevNoder</h2>
            <div className="about-logo">
              <span className="about-icon">🌊</span>
              <div>
                <div className="about-name">DevNoder</div>
                <div className="about-tagline">Serve • Grow • Lead</div>
              </div>
            </div>
            <div className="settings-group">
              {[
                ['Version', '0.1.0'],
                ['Built by', 'Srvel — Bamako, Mali'],
                ['License', 'AGPL-3.0'],
                ['Infrastructure', '100% Cloudflare Free Tier'],
                ['Reference device', 'Samsung A72 (Android 14, 8GB RAM)'],
                ['PWA', 'Yes — installable, fully offline'],
              ].map(([k, v]) => (
                <div key={k} className="about-row">
                  <span className="about-key">{k}</span>
                  <span className="about-val">{v}</span>
                </div>
              ))}
            </div>
            <div className="about-links">
              <a href="https://srvel.io" target="_blank" rel="noopener noreferrer">srvel.io</a>
              <a href="https://github.com/srvel/devnoder" target="_blank" rel="noopener noreferrer">GitHub</a>
              <a href="https://docs.devnoder.srvel.io" target="_blank" rel="noopener noreferrer">Docs</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
