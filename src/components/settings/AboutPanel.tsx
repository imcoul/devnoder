import { useState, useEffect } from 'react'
import { useStore } from '@nanostores/react'
import { $subscription } from '../../services/cloud/CloudTier'
import './AboutPanel.css'

const VERSION = '0.1.0'

const SPONSORS = [
  { name: 'Your name here', tier: 'gold',   url: 'https://github.com/sponsors/srvel-build' },
]

const OPEN_SOURCE_DEPS = [
  { name: 'CodeMirror 6',     license: 'MIT',     url: 'https://codemirror.net' },
  { name: 'Yjs',              license: 'MIT',     url: 'https://yjs.dev' },
  { name: 'isomorphic-git',   license: 'MIT',     url: 'https://isomorphic-git.org' },
  { name: 'GrapesJS',         license: 'BSD-3',   url: 'https://grapesjs.com' },
  { name: 'React',            license: 'MIT',     url: 'https://react.dev' },
  { name: 'Vite',             license: 'MIT',     url: 'https://vitejs.dev' },
  { name: 'Pyodide',          license: 'MPL-2.0', url: 'https://pyodide.org' },
  { name: 'WebLLM',           license: 'Apache-2',url: 'https://webllm.mlc.ai' },
  { name: 'Transformers.js',  license: 'Apache-2',url: 'https://xenova.github.io/transformers.js' },
  { name: 'xterm.js',         license: 'MIT',     url: 'https://xtermjs.org' },
  { name: 'Dexie.js',         license: 'Apache-2',url: 'https://dexie.org' },
  { name: 'Nanostores',       license: 'MIT',     url: 'https://github.com/nanostores/nanostores' },
  { name: 'Prettier',         license: 'MIT',     url: 'https://prettier.io' },
  { name: 'Emmet',            license: 'MIT',     url: 'https://emmet.io' },
]

export default function AboutPanel() {
  const sub       = useStore($subscription)
  const [tab, setTab] = useState<'about' | 'credits' | 'license'>('about')
  const [buildDate] = useState(() => new Date().toLocaleDateString())

  return (
    <div className="about-panel">
      {/* Srvel header */}
      <div className="about-hero">
        <div className="about-hero__logo" aria-label="DevNoder logo">
          <span className="about-hero__dn" aria-hidden="true">DN</span>
        </div>
        <h1 className="about-hero__name">DevNoder</h1>
        <p className="about-hero__tagline">Mobile-first offline IDE</p>
        <div className="about-hero__meta">
          <span className="about-meta__item">v{VERSION}</span>
          <span className="about-meta__sep" aria-hidden="true">·</span>
          <span className="about-meta__item">AGPL-3.0</span>
          <span className="about-meta__sep" aria-hidden="true">·</span>
          <span className="about-meta__item">Built by Srvel</span>
        </div>
        <p className="about-hero__byline">Serve • Grow • Lead — Bamako 🇲🇱</p>
      </div>

      {/* Tabs */}
      <div className="about-tabs" role="tablist">
        {(['about', 'credits', 'license'] as const).map(t => (
          <button key={t} className={`about-tab ${tab === t ? 'about-tab--active' : ''}`}
            onClick={() => setTab(t)} role="tab" aria-selected={tab === t}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* About tab */}
      {tab === 'about' && (
        <div className="about-body">
          <div className="about-info-grid">
            <div className="about-info-row"><span>Version</span><code>{VERSION}</code></div>
            <div className="about-info-row"><span>Build date</span><code>{buildDate}</code></div>
            <div className="about-info-row"><span>License</span><code>AGPL-3.0</code></div>
            <div className="about-info-row"><span>Plan</span><code>{sub.tier}</code></div>
          </div>

          <div className="about-links">
            <a href="https://github.com/srvel-build/devnoder" target="_blank" rel="noopener noreferrer" className="about-link">
              <span aria-hidden="true">⑂</span> Source code (GitHub)
            </a>
            <a href="https://devnoder.srvel.net" target="_blank" rel="noopener noreferrer" className="about-link">
              <span aria-hidden="true">🌐</span> devnoder.srvel.net
            </a>
            <a href="https://github.com/srvel-build/devnoder/issues" target="_blank" rel="noopener noreferrer" className="about-link">
              <span aria-hidden="true">🐛</span> Report a bug
            </a>
            <a href="https://github.com/sponsors/srvel-build" target="_blank" rel="noopener noreferrer" className="about-link about-link--sponsor">
              <span aria-hidden="true">❤</span> Sponsor DevNoder
            </a>
          </div>

          {/* Sponsors */}
          <div className="about-sponsors">
            <h3 className="about-section-title">Sponsors</h3>
            {SPONSORS.map(s => (
              <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer"
                className={`sponsor-item sponsor-item--${s.tier}`}>
                <span className="sponsor-item__tier">{s.tier}</span>
                <span className="sponsor-item__name">{s.name}</span>
              </a>
            ))}
            <a href="https://github.com/sponsors/srvel-build" target="_blank" rel="noopener noreferrer"
              className="sponsor-cta">
              Become a sponsor →
            </a>
          </div>

          <div className="about-philosophy">
            <h3 className="about-section-title">Philosophy</h3>
            <p>DevNoder exists because powerful developer tools shouldn't require expensive hardware, stable internet, or a credit card. Built in Bamako. Designed for every developer.</p>
            <p>The AGPL license means this codebase stays open forever. If you run a hosted version, your changes must be shared back with the community.</p>
          </div>
        </div>
      )}

      {/* Credits tab */}
      {tab === 'credits' && (
        <div className="about-body">
          <h3 className="about-section-title">Open Source Dependencies</h3>
          <p className="about-credits-intro">DevNoder is built on the shoulders of giants. All dependencies listed below.</p>
          <div className="credits-list" role="list">
            {OPEN_SOURCE_DEPS.map(dep => (
              <a key={dep.name} href={dep.url} target="_blank" rel="noopener noreferrer"
                className="credit-item" role="listitem">
                <span className="credit-item__name">{dep.name}</span>
                <span className="credit-item__license">{dep.license}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* License tab */}
      {tab === 'license' && (
        <div className="about-body">
          <h3 className="about-section-title">GNU Affero General Public License v3.0</h3>
          <div className="license-summary">
            <div className="license-item license-item--can">
              <span className="license-item__icon">✓</span>
              <div>
                <strong>You can</strong>
                <ul>
                  <li>Use commercially</li>
                  <li>Modify the source</li>
                  <li>Distribute copies</li>
                  <li>Patent use</li>
                  <li>Private use</li>
                </ul>
              </div>
            </div>
            <div className="license-item license-item--must">
              <span className="license-item__icon">!</span>
              <div>
                <strong>You must</strong>
                <ul>
                  <li>Disclose source</li>
                  <li>License under AGPL</li>
                  <li>State changes made</li>
                  <li>Share network use modifications</li>
                </ul>
              </div>
            </div>
            <div className="license-item license-item--cannot">
              <span className="license-item__icon">✕</span>
              <div>
                <strong>You cannot</strong>
                <ul>
                  <li>Sublicense</li>
                  <li>Hold liable</li>
                  <li>Use trademark</li>
                </ul>
              </div>
            </div>
          </div>
          <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank"
            rel="noopener noreferrer" className="about-link" style={{ marginBlockStart: 'var(--space-4)', display: 'inline-flex' }}>
            Read full license →
          </a>
        </div>
      )}
    </div>
  )
}
