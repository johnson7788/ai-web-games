// 语言：默认英文；?lang= > localStorage > CONFIG.defaultLang('en')
// 只暴露 locales 里真实存在的语言；缺 key 回退 en；ar 自动 RTL。
// 刻意不读 navigator.language：默认英文是产品决定，其他语言由用户显式切换。
import { locales } from '../../config/locales.js';
import { CONFIG } from '../../config/game.config.js';

const RTL = new Set(CONFIG.rtlLangs || []);

function availableLangs() {
  const list = CONFIG.languages || Object.keys(locales);
  return list.filter((code) => locales[code]);
}

function detectLang() {
  try {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (q && locales[q]) return q;
    const saved = window.localStorage.getItem(CONFIG.langStorageKey);
    if (saved && locales[saved]) return saved;
  } catch {
    /* 隐私模式 / 非浏览器环境 */
  }
  return CONFIG.defaultLang || 'en';
}

let currentLang = detectLang();

export function syncDocumentLang() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = currentLang;
  document.documentElement.dir = RTL.has(currentLang) ? 'rtl' : 'ltr';
}

export const i18n = {
  get lang() {
    return currentLang;
  },
  get dir() {
    return RTL.has(currentLang) ? 'rtl' : 'ltr';
  },
  get list() {
    return availableLangs();
  },
  options() {
    return availableLangs().map((code) => ({
      code,
      name: (CONFIG.langNames && CONFIG.langNames[code]) || code,
    }));
  },
  get(key, vars) {
    let s = locales[currentLang]?.[key] ?? locales.en[key] ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
    return s;
  },
  setLang(lang) {
    if (!locales[lang] || lang === currentLang) return false;
    currentLang = lang;
    try {
      window.localStorage.setItem(CONFIG.langStorageKey, lang);
    } catch {
      /* 隐私模式降级 */
    }
    syncDocumentLang();
    return true;
  },
  next() {
    const list = availableLangs();
    return list[(list.indexOf(currentLang) + 1) % list.length];
  },
};

export const t = (key, vars) => i18n.get(key, vars);
