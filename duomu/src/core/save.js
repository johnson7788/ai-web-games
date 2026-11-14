/**
 * 存档。所有读写集中在这里，业务代码不许直接摸 localStorage / SDK。
 * 底层走 Sdk：SDK 可用就用 SDK，不可用自动落 localStorage，隐私模式不崩。
 */
import Sdk from './sdk.js';

const DEFAULTS = {
  bestLogs: 0,
  bestCombo: 0,
  wins: 0,
  plays: 0,
  revives: 0,
  sound: true,
  lang: 'en',
  aiLevel: 'veteran',
};

const KEY = 'profile';
let cache = null;

function sanitize(data) {
  const out = { ...DEFAULTS };
  if (!data || typeof data !== 'object') return out;
  for (const key of Object.keys(DEFAULTS)) {
    const def = DEFAULTS[key];
    const val = data[key];
    if (typeof def === 'number') {
      out[key] = Number.isFinite(val) ? Math.max(0, Math.floor(val)) : def;
    } else if (typeof def === 'boolean') {
      out[key] = typeof val === 'boolean' ? val : def;
    } else {
      out[key] = typeof val === 'string' ? val : def;
    }
  }
  return out;
}

export function load() {
  if (!cache) cache = sanitize(Sdk.load(KEY, null));
  return cache;
}

export function save(patch) {
  cache = { ...load(), ...patch };
  Sdk.save(KEY, cache);
  return cache;
}

/** 一局结束后的汇总：只在真的破纪录时才写盘 */
export function recordMatch({ logs, combo, won, revived }) {
  const cur = load();
  const patch = { plays: cur.plays + 1 };
  if (won) patch.wins = cur.wins + 1;
  if (revived) patch.revives = (cur.revives || 0) + 1;
  if (logs > cur.bestLogs) patch.bestLogs = logs;
  if (combo > cur.bestCombo) patch.bestCombo = combo;
  return save(patch);
}
