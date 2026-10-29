import React, { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { useTranslation } from 'react-i18next';
import { $theme, $lang, $ui, ThemeId, Lang, setPanel } from '../../stores/ui';
import { subscriptionService, PLANS, Tier } from '../../services/revenue/SubscriptionService';
import { audioCueService, CueConfig } from '../../services/accessibility/AudioCueService';
import { aiGateway } from '../../services/ai/AIGateway';
import { AppIcon } from '../brand/AppIcon';
import AboutPanel from './AboutPanel';
import './SettingsPanel.css';

const THEMES: Array<{ id: ThemeId; label: string }> = [
  { id: 'default', label: 'Default (Dark)' },
  { id: 'light', label: 'Light' },
  { id: 'protanopia', label: 'Protanopia' },
  { id: 'deuteranopia', label: 'Deuteranopia' },
  { id: 'tritanopia', label: 'Tritanopia' },
  { id: 'hc-aaa', label: 'High Contrast AAA' },
  { id: 'hc-light', label: 'High Contrast Light' },
  { id: 'grayscale', label: 'Grayscale' },
];

const LANGS: Array<{ id: Lang; label: string; dir: 'ltr' | 'rtl' }> = [
  { id: 'en', label: 'English', dir: 'ltr' },
  { id: 'fr', label: 'Français', dir: 'ltr' },
  { id: 'ar', label: 'العربية', dir: 'rtl' },
];

type Section = 'appearance' | 'editor' | 'ai' | 'subscription' | 'accessibility' | 'about';

export default function SettingsPanel() {
  const { i18n } = useTranslation();
  const theme = useStore($theme);
  const lang = useStore($lang);
  const ui = useStore($ui);
  const [section, setSection] = useState<Section>('appearance');
  const [tier, setTier] = useState<Tier>('free');
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseMsg, setLicenseMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [keys, setKeys] = useState<Record<string, string>>({ groq: '', openai: '', anthropic: '', openrouter: '' });
  const [saved, setSaved] = useState(false);
  const [audioCfg, setAudioCfg] = useState<CueConfig>(() => audioCueService.getConfig());

  useEffect(() => {
    subscriptionService.load();
    setTier(subscriptionService.getTier());
    aiGateway.loadKeys();
    const loaded: Record<string, string> = {};
    ['groq', 'openai', 'anthropic', 'openrouter'].forEach(provider => {
      loaded[provider] = localStorage.getItem(`devnoder-key-${provider}`) ? '••••••••' : '';
    });
    setKeys(loaded);
  }, []);

  const setTheme = (id: ThemeId) => {
    $theme.set(id);
    localStorage.setItem('devnoder-theme', id);
  };

  const setLanguage = (id: Lang) => i18n.changeLanguage(id);

  const saveEditorSettings = () => {
    localStorage.setItem('devnoder-ui', JSON.stringify($ui.get()));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const saveApiKey = (provider: string, value: string) => {
    if (value && !value.startsWith('•')) aiGateway.setKey(provider as never, value);
  };

  const openAiSettings = () => {
    sessionStorage.setItem('devnoder-open-ai-settings', '1');
    setPanel('ai');
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

  const updateAudio = (patch: Partial<CueConfig>) => {
    audioCueService.updateConfig(patch);
    setAudioCfg(audioCueService.getConfig());
  };

  const sections: Array<{ id: Section; label: string; icon: string }> = [
    { id: 'appearance', label: 'Appearance', icon: 'palette' },
    { id: 'editor', label: 'Editor', icon: 'code' },
    { id: 'ai', label: 'AI setup', icon: 'ai' },
    { id: 'subscription', label: 'Subscription', icon: 'key' },
    { id: 'accessibility', label: 'Accessibility', icon: 'speaker' },
    { id: 'about', label: 'About', icon: 'info' },
  ];

  return (
    <div className="settings-panel">
      <nav className="settings-nav" aria-label="Settings sections">
        {sections.map(item => (
          <button key={item.id} className={`settings-nav-btn ${section === item.id ? 'active' : ''}`} onClick={() => setSection(item.id)}>
            <AppIcon name={item.icon} size={18} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="settings-content">
        {section === 'appearance' && (
          <div className="settings-section">
            <h2 className="settings-section-title">Appearance</h2>
            <div className="settings-group">
              <div className="settings-group-label">Theme</div>
              <div className="theme-grid">
                {THEMES.map(item => (
                  <button key={item.id} className={`theme-btn ${theme === item.id ? 'active' : ''}`} onClick={() => setTheme(item.id)} data-theme={item.id}>
                    <span className="theme-btn-swatch" />
                    <span className="theme-btn-label">{item.label}</span>
                    {theme === item.id && <AppIcon name="check" size={16} />}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-group">
              <div className="settings-group-label">Language</div>
              <div className="lang-options">
                {LANGS.map(item => (
                  <button key={item.id} className={`lang-btn ${lang === item.id ? 'active' : ''}`} onClick={() => setLanguage(item.id)} dir={item.dir}>{item.label}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {section === 'editor' && (
          <div className="settings-section">
            <h2 className="settings-section-title">Editor</h2>
            <div className="settings-group">
              <label className="settings-field"><span>Font size</span><div className="settings-field-row"><input type="range" min={10} max={24} value={ui.fontSize} onChange={event => $ui.setKey('fontSize', Number(event.target.value))} /><span className="settings-field-val">{ui.fontSize}px</span></div></label>
              <label className="settings-field"><span>Tab size</span><select className="settings-select" value={ui.tabSize} onChange={event => $ui.setKey('tabSize', Number(event.target.value))}>{[2, 4, 8].map(size => <option key={size} value={size}>{size} spaces</option>)}</select></label>
              <label className="settings-field settings-field--row"><span>Word wrap</span><input type="checkbox" checked={ui.wordWrap} onChange={event => $ui.setKey('wordWrap', event.target.checked)} /></label>
            </div>
            <button className="settings-save-btn" onClick={saveEditorSettings}><AppIcon name={saved ? 'check' : 'save'} size={16} />{saved ? 'Saved' : 'Save editor settings'}</button>
          </div>
        )}

        {section === 'ai' && (
          <div className="settings-section">
            <h2 className="settings-section-title">AI setup</h2>
            <p className="settings-desc">Models, providers, and encrypted browser-local keys live in the AI workspace. Some model paths need a network connection, device storage, or provider quota; general-purpose native tools are outside this browser runtime.</p>
            <div className="settings-callout">
              <AppIcon name="lock" size={20} />
              <div><strong>One setup destination</strong><span>Open the AI workspace to choose a supported model or configure a provider.</span></div>
            </div>
            <button className="settings-save-btn" onClick={openAiSettings}><AppIcon name="ai" size={17} />Open AI workspace</button>
          </div>
        )}

        {section === 'subscription' && (
          <div className="settings-section">
            <h2 className="settings-section-title">Subscription</h2>
            <div className={`current-plan-card plan-card--${tier}`}><div className="plan-card-tier">{subscriptionService.getPlan().name}</div><div className="plan-card-price">{subscriptionService.getPlan().price}</div>{tier !== 'free' && subscriptionService.daysRemaining() !== null && <div className="plan-card-expiry">{subscriptionService.daysRemaining()} days remaining</div>}</div>
            {tier !== 'free' && <button className="settings-danger-btn" onClick={deactivate}>Deactivate license</button>}
            {tier === 'free' && <div className="license-activate"><div className="settings-group-label">Have a license key?</div><div className="settings-field-row"><input className="settings-input" value={licenseKey} placeholder="PRO-XXXX-XXXX-XXXX" onChange={event => setLicenseKey(event.target.value)} /><button className="settings-save-btn" onClick={activateLicense}>Activate</button></div>{licenseMsg && <p className={`license-msg ${licenseMsg.ok ? 'license-msg--ok' : 'license-msg--err'}`}>{licenseMsg.text}</p>}</div>}
            <div className="plan-grid">{PLANS.map(plan => <div key={plan.id} className={`plan-option ${tier === plan.id ? 'plan-option--current' : ''}`}><div className="plan-option-name">{plan.name}</div><div className="plan-option-price">{plan.price}</div><ul className="plan-features">{plan.features.slice(0, 6).map((feature, index) => <li key={index}><AppIcon name="check" size={14} />{feature}</li>)}{plan.features.length > 6 && <li className="plan-more">+{plan.features.length - 6} more</li>}</ul>{tier !== plan.id && plan.id !== 'free' && <a className="plan-upgrade-btn" href="https://srvel.net" target="_blank" rel="noopener noreferrer">Learn about plans <AppIcon name="arrowsquareout" size={14} /></a>}{tier === plan.id && <span className="plan-current-badge">Current plan</span>}</div>)}</div>
          </div>
        )}

        {section === 'accessibility' && (
          <div className="settings-section">
            <h2 className="settings-section-title">Accessibility</h2>
            <p className="settings-desc">Optional audio cues provide spoken and tonal feedback. Keyboard navigation, screen readers, reduced motion, themes, and RTL language support remain available without audio.</p>
            <div className="settings-group">
              <label className="settings-field settings-field--row"><span>Enable audio cues</span><input type="checkbox" checked={audioCfg.enabled} onChange={event => updateAudio({ enabled: event.target.checked })} /></label>
              {audioCfg.enabled && <><label className="settings-field settings-field--row"><span>Speech announcements</span><input type="checkbox" checked={audioCfg.speechEnabled} onChange={event => updateAudio({ speechEnabled: event.target.checked })} /></label><label className="settings-field settings-field--row"><span>Tone cues</span><input type="checkbox" checked={audioCfg.tonesEnabled} onChange={event => updateAudio({ tonesEnabled: event.target.checked })} /></label><label className="settings-field"><span>Volume</span><div className="settings-field-row"><input type="range" min={0} max={1} step={0.05} value={audioCfg.volume} onChange={event => updateAudio({ volume: parseFloat(event.target.value) })} /><span className="settings-field-val">{Math.round(audioCfg.volume * 100)}%</span></div></label><label className="settings-field"><span>Speech rate</span><div className="settings-field-row"><input type="range" min={0.5} max={2} step={0.1} value={audioCfg.speechRate} onChange={event => updateAudio({ speechRate: parseFloat(event.target.value) })} /><span className="settings-field-val">{audioCfg.speechRate}×</span></div></label></>}
            </div>
          </div>
        )}

        {section === 'about' && <AboutPanel />}
      </div>
    </div>
  );
}
