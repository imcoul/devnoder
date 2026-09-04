import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import fr from './locales/fr.json';
import ar from './locales/ar.json';
import { $lang, type Lang } from '../stores/ui';

const SUPPORTED_LANGS: Lang[] = ['en', 'fr', 'ar'];
const RTL_LANGS: Lang[] = ['ar'];

function toSupportedLang(lng: string | undefined): Lang {
  const base = lng?.split('-')[0] as Lang;
  return SUPPORTED_LANGS.includes(base) ? base : 'en';
}

function applyDocumentDirection(lang: Lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr';
}

i18n.use(LanguageDetector).use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr }, ar: { translation: ar } },
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGS,
  interpolation: { escapeValue: false },
  detection: {
    order: ['localStorage', 'navigator'],
    lookupLocalStorage: 'devnoder-lang',
    caches: ['localStorage'],
  },
});

// The detector above already resolved the language to use (an explicit
// devnoder-lang preference, else the browser locale) — apply it to the
// document and the UI store right away instead of leaving dir="ltr"
// hardcoded until the user happens to open Settings and click a language.
const bootLang = toSupportedLang(i18n.language);
$lang.set(bootLang);
applyDocumentDirection(bootLang);

i18n.on('languageChanged', lng => {
  const lang = toSupportedLang(lng);
  $lang.set(lang);
  applyDocumentDirection(lang);
});

export default i18n;
