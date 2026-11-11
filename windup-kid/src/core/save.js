// 本地存档：关卡星级 / 最佳用时 / 设置。读写失败静默降级到内存。
const KEY = 'windupkid_save_v1';

const DEFAULTS = () => ({
  v: 1,
  levels: {},
  unlocked: 1,
  totalGears: 0,
  settings: { music: 0.7, sfx: 0.8, shake: true },
});

let memory = null;

export function loadSave() {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return (memory = DEFAULTS());
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return (memory = DEFAULTS());
    memory = { ...DEFAULTS(), ...data, settings: { ...DEFAULTS().settings, ...data.settings } };
    return memory;
  } catch {
    return (memory = DEFAULTS());
  }
}

export function writeSave(patch) {
  memory = { ...loadSave(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* 隐私模式：仅内存 */ }
  return memory;
}

/**
 * 记录一次通关。
 * @param {string} levelId '1-1'
 * @param {{time:number,gears:number,total:number,deaths:number}} stats
 * @param {number} unlockNext 通关后至少解锁到第几关（1 基序号）
 */
export function recordClear(levelId, { time, gears, total, deaths }, unlockNext = 1) {
  const save = loadSave();
  const prev = save.levels[levelId] || { stars: 0, best: Infinity, gears: 0 };

  let stars = 1;
  if (gears >= Math.ceil(total * 0.8)) stars++;
  if (deaths === 0) stars++;

  const levels = {
    ...save.levels,
    [levelId]: {
      stars: Math.max(prev.stars, stars),
      best: Math.min(prev.best, time),
      gears: Math.max(prev.gears, gears),
    },
  };
  const unlocked = Math.max(save.unlocked, unlockNext);
  writeSave({ levels, unlocked });
  return { stars: levels[levelId].stars, earned: stars, isBest: time <= prev.best, unlocked };
}

export function levelStars(levelId) { return loadSave().levels[levelId]?.stars ?? 0; }

export function totalStars() {
  return Object.values(loadSave().levels).reduce((n, l) => n + (l.stars || 0), 0);
}

export function addGears(n) {
  const save = loadSave();
  return writeSave({ totalGears: (save.totalGears || 0) + n });
}

export function updateSettings(patch) {
  const save = loadSave();
  return writeSave({ settings: { ...save.settings, ...patch } });
}

export function resetSave() {
  memory = DEFAULTS();
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
  return memory;
}
