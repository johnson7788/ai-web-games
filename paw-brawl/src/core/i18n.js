import { LOCALES } from '../../config/locales.js';
import { CONFIG } from '../../config/game.config.js';

let lang = 'en';

export function setLang(next) {
  const requested = next === 'auto' && typeof navigator !== 'undefined'
    ? (navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en')
    : next;
  lang = LOCALES[requested] ? requested : 'en';
  if (typeof document !== 'undefined') document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  return lang;
}

export function getLang() { return lang; }

export function t(key, vars = {}) {
  let text = LOCALES[lang]?.[key] ?? LOCALES.en[key] ?? key;
  for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value));
  return text;
}

export function applyI18n(root = typeof document !== 'undefined' ? document : null) {
  if (!root) return;
  root.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
}

setLang(CONFIG.lang);
