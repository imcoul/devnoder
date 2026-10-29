import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/instrument-sans/latin-400.css';
import '@fontsource/instrument-sans/latin-600.css';
import '@fontsource/instrument-sans/latin-700.css';
import '@fontsource/instrument-sans/latin-ext-400.css';
import '@fontsource/instrument-sans/latin-ext-600.css';
import '@fontsource/instrument-sans/latin-ext-700.css';
import '@fontsource/livvic/latin-400.css';
import '@fontsource/livvic/latin-500.css';
import '@fontsource/livvic/latin-700.css';
import '@fontsource/livvic/latin-ext-400.css';
import '@fontsource/livvic/latin-ext-500.css';
import '@fontsource/livvic/latin-ext-700.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '@fontsource/jetbrains-mono/latin-ext-400.css';
import '@fontsource/jetbrains-mono/latin-ext-700.css';
import App from './App';
import './utils/crypto';
import './services/register';
import './styles/tokens.css';
import './styles/base.css';
import './i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
