// 国际化：?lang=zh|en > localStorage > 浏览器语言；所有可见文字走 t()
import { locales } from "../../config/locales.js";
import { unitName } from "../../config/data.js";

export const LANG_LIST = ["zh", "en"];
const LANG_KEY = "srw2hd.lang";

function detectLang() {
  try {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q && LANG_LIST.includes(q)) return q;
    const saved = window.localStorage.getItem(LANG_KEY);
    if (saved && LANG_LIST.includes(saved)) return saved;
    const nav = (navigator.language || "zh").toLowerCase();
    return nav.startsWith("zh") ? "zh" : "en";
  } catch {
    return "zh";
  }
}

let lang = detectLang();
const listeners = new Set();

export const i18n = {
  get lang() {
    return lang;
  },
  get list() {
    return LANG_LIST;
  },
  t(key, vars) {
    const table = locales[lang] || locales.zh;
    let s = table[key] ?? locales.zh[key] ?? key;
    if (vars && typeof s === "string") {
      s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ""));
    }
    return s;
  },
  setLang(next) {
    if (!LANG_LIST.includes(next) || next === lang) return false;
    lang = next;
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      /* 隐私模式降级 */
    }
    listeners.forEach((fn) => fn(lang));
    return true;
  },
  toggle() {
    this.setLang(lang === "zh" ? "en" : "zh");
  },
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
};

export const t = (key, vars) => i18n.t(key, vars);

/** 关卡目标的本地化描述 */
export function objectiveText(scenario, kind = "victory") {
  const obj = scenario.objective || {};
  const cond = kind === "victory" ? obj.victory : obj.defeat;
  const names = (list) => (list || []).map((n) => unitName(n, lang)).join("、");
  if (!cond) return kind === "victory" ? t("objAnnihilate") : t("objAllDead");
  if (kind === "defeat") {
    if (cond.type === "protect") return t("objProtect", { targets: names(cond.units) });
    if (cond.type === "turnLimit") return t("objTurnLimit", { n: cond.turns });
    return t("objAllDead");
  }
  if (cond.type === "destroy") {
    const targets = cond.targets && cond.targets[0] === "__boss__"
      ? (lang === "en" ? "the boss" : "BOSS")
      : names(cond.targets);
    return t("objDestroy", { targets });
  }
  if (cond.type === "escape") {
    const exit = t(cond.exit === "right" ? "exitRight" : cond.exit === "bottom" ? "exitBottom" : cond.exit === "left" ? "exitLeft" : "exitTop");
    return cond.turns ? t("objEscapeTurns", { exit, n: cond.turns }) : t("objEscape", { exit });
  }
  if (cond.type === "survive") return t("objSurvive", { n: cond.turns });
  return t("objAnnihilate");
}

export function objectiveLine(scenario) {
  const v = objectiveText(scenario, "victory");
  const d = objectiveText(scenario, "defeat");
  return `${t("objectiveLabel", { text: v })}  ·  ${t("defeatLabel", { text: d })}`;
}
