// src/core/i18n.js — 双语词条读取（唯一来源 config/locales.js）
// 规格：页面默认英文；页面不放语言切换按钮。语言可由平台通过 ?lang=zh 或
// localStorage["pipy:lang"] 指定（无 UI 入口），默认回落 en。
import { LOCALES } from "config/locales.js";

const LANG_KEY = "pipy:lang";
const SUPPORTED = ["en", "zh"];

function pickLang() {
  let v = "en";
  try {
    const q = new URLSearchParams(location.search).get("lang");
    v = (q || localStorage.getItem(LANG_KEY) || "en").toLowerCase();
  } catch (_) {
    v = "en";
  }
  return SUPPORTED.includes(v) ? v : "en";
}

export const lang = pickLang();
export const dict = LOCALES[lang] || LOCALES.en;

/** 取词条，{n} 占位按 vars 替换；缺键回落 en，再缺原样返回 key（便于静态发现漏词）。 */
export function t(key, vars) {
  const s = dict[key] ?? LOCALES.en[key] ?? key;
  if (!vars) return s;
  return String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** 把带 data-i18n 的静态节点刷成当前语言（文案只写 HTML 结构，文字全部来自词条）。 */
export function applyStatic(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const txt = t(key);
    if (txt && el.textContent !== txt) el.textContent = txt;
  });
  if (document.documentElement) {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }
}

/** 仅供平台/调试切换：写入偏好后重载（游戏内不提供按钮，符合规格）。 */
export function setLang(next) {
  if (!SUPPORTED.includes(next)) return;
  try { localStorage.setItem(LANG_KEY, next); } catch (_) { /* 隐私模式忽略 */ }
  location.reload();
}
