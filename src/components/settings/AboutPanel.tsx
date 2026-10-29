import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { $subscription } from '../../services/cloud/CloudTier';
import { AppIcon } from '../brand/AppIcon';
import { BrandLockup } from '../brand/BrandLockup';
import { PRODUCT_IDENTITY } from '../../config/productIdentity';
import './AboutPanel.css';

const VERSION = '0.1.0';

const OPEN_SOURCE_DEPS = [
  { name: 'CodeMirror 6', license: 'MIT', url: 'https://codemirror.net' },
  { name: 'Yjs', license: 'MIT', url: 'https://yjs.dev' },
  { name: 'isomorphic-git', license: 'MIT', url: 'https://isomorphic-git.org' },
  { name: 'GrapesJS', license: 'BSD-3', url: 'https://grapesjs.com' },
  { name: 'React', license: 'MIT', url: 'https://react.dev' },
  { name: 'Vite', license: 'MIT', url: 'https://vitejs.dev' },
  { name: 'Pyodide', license: 'MPL-2.0', url: 'https://pyodide.org' },
  { name: 'WebLLM', license: 'Apache-2', url: 'https://webllm.mlc.ai' },
  { name: 'Transformers.js', license: 'Apache-2', url: 'https://huggingface.co/docs/transformers.js' },
  { name: 'xterm.js', license: 'MIT', url: 'https://xtermjs.org' },
  { name: 'Dexie.js', license: 'Apache-2', url: 'https://dexie.org' },
  { name: 'Nanostores', license: 'MIT', url: 'https://github.com/nanostores/nanostores' },
];

export default function AboutPanel() {
  const subscription = useStore($subscription);
  const [tab, setTab] = useState<'about' | 'credits' | 'license'>('about');
  const [buildDate] = useState(() => new Date().toLocaleDateString());

  return (
    <div className="about-panel">
      <div className="about-hero">
        <BrandLockup />
        <p className="about-hero__tagline">A browser-local development workbench</p>
        <div className="about-hero__meta"><span>v{VERSION}</span><span aria-hidden="true">·</span><span>{PRODUCT_IDENTITY.license}</span></div>
        <p className="about-hero__byline">Build something useful, wherever you work.</p>
      </div>

      <div className="about-tabs" role="tablist" aria-label="About DevNoder">
        {(['about', 'credits', 'license'] as const).map(item => (
          <button key={item} className={`about-tab ${tab === item ? 'about-tab--active' : ''}`} onClick={() => setTab(item)} role="tab" aria-selected={tab === item}>{item.charAt(0).toUpperCase() + item.slice(1)}</button>
        ))}
      </div>

      {tab === 'about' && <div className="about-body">
        <div className="about-info-grid">
          <div className="about-info-row"><span>Version</span><code>{VERSION}</code></div>
          <div className="about-info-row"><span>Build date</span><code>{buildDate}</code></div>
          <div className="about-info-row"><span>License</span><code>{PRODUCT_IDENTITY.license}</code></div>
          <div className="about-info-row"><span>Plan state</span><code>{subscription.tier}</code></div>
        </div>

        <div className="about-links">
          <a href={PRODUCT_IDENTITY.source} target="_blank" rel="noopener noreferrer" className="about-link"><AppIcon name="github" size={18} />Source code</a>
          <a href={PRODUCT_IDENTITY.guide} className="about-link"><AppIcon name="filetext" size={18} />Read the public guide</a>
          <a href={PRODUCT_IDENTITY.issues} target="_blank" rel="noopener noreferrer" className="about-link"><AppIcon name="bug" size={18} />Report an issue</a>
        </div>

        <div className="about-philosophy">
          <h3 className="about-section-title">What this app is</h3>
          <p>DevNoder keeps project files in this browser and makes the useful loop visible: open a project, edit a file, preview supported browser content, and export a backup.</p>
          <p>It is not a general native toolchain or package manager. Model downloads, provider requests, browser storage, and available runtimes have practical device, network, quota, and recovery limits. Export a backup before clearing browser data.</p>
        </div>
      </div>}

      {tab === 'credits' && <div className="about-body">
        <h3 className="about-section-title">Open source dependencies</h3>
        <p className="about-credits-intro">DevNoder is assembled from open source tools. Their licenses and project pages are listed here for reference.</p>
        <div className="credits-list" role="list">{OPEN_SOURCE_DEPS.map(dep => <a key={dep.name} href={dep.url} target="_blank" rel="noopener noreferrer" className="credit-item" role="listitem"><span>{dep.name}</span><span className="credit-item__license">{dep.license}</span></a>)}</div>
      </div>}

      {tab === 'license' && <div className="about-body">
        <h3 className="about-section-title">GNU Affero General Public License v3.0</h3>
        <div className="license-summary">
          <div className="license-item license-item--can"><AppIcon name="check" size={20} /><div><strong>You can</strong><ul><li>Use commercially</li><li>Modify the source</li><li>Distribute copies</li><li>Use privately</li></ul></div></div>
          <div className="license-item license-item--must"><AppIcon name="warning" size={20} /><div><strong>You must</strong><ul><li>Disclose source</li><li>License under AGPL</li><li>State changes made</li><li>Share network-use modifications</li></ul></div></div>
          <div className="license-item license-item--cannot"><AppIcon name="close" size={20} /><div><strong>Trademark note</strong><ul><li>Source license does not grant brand rights</li></ul></div></div>
        </div>
        <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener noreferrer" className="about-link about-link--inline">Read the full license <AppIcon name="arrowsquareout" size={15} /></a>
      </div>}
    </div>
  );
}
