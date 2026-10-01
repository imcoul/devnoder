import React, { useState, useEffect } from 'react';
import { showToast } from '../../stores/ui';
import './InstallPrompt.css';

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') {
      showToast({ type: 'success', message: 'DevNoder installed — find it on your home screen' });
    }
    setDeferred(null);
  };

  if (installed || !deferred) return null;

  return (
    <button className="install-prompt" onClick={install} title="Install DevNoder as an app">
      ⬇ Install
    </button>
  );
}
