import { CONFIG } from '../../config/game.config.js';

const DEFAULTS = Object.freeze({
  best: 0,
  runs: 0,
  cleared: 0,
  lore: [],
  seenIntro: false,
  bestAct: 0,
  settings: { music: 55, sfx: 85, shake: true, quality: 'high', lang: 'auto' },
});

let cache = null;
let warned = false;

function read() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(CONFIG.saveKey);
    const parsed = raw ? JSON.parse(raw) : {};
    cache = {
      ...DEFAULTS,
      ...parsed,
      settings: { ...DEFAULTS.settings, ...(parsed.settings || {}) },
      lore: Array.isArray(parsed.lore) ? parsed.lore : [],
    };
  } catch (error) {
    if (!warned) {
      warned = true;
      console.warn('[save] storage unavailable, running in memory', error?.message || error);
    }
    cache = { ...DEFAULTS, settings: { ...DEFAULTS.settings }, lore: [] };
  }
  return cache;
}

function write() {
  try {
    localStorage.setItem(CONFIG.saveKey, JSON.stringify(read()));
  } catch (error) {
    if (!warned) {
      warned = true;
      console.warn('[save] cannot persist', error?.message || error);
    }
  }
}

export function load() { return read(); }

export function patch(partial) {
  const state = read();
  Object.assign(state, partial);
  write();
  return state;
}

export function setSetting(key, value) {
  const state = read();
  state.settings[key] = value;
  write();
  return state.settings;
}

export function unlockLore(index) {
  const state = read();
  if (!state.lore.includes(index)) {
    state.lore.push(index);
    state.lore.sort((a, b) => a - b);
    write();
    return true;
  }
  return false;
}

export function addRun({ score = 0, cleared: didClear = false, act = 0 } = {}) {
  const state = read();
  state.runs += 1;
  state.best = Math.max(state.best, Math.round(score));
  state.bestAct = Math.max(state.bestAct, act);
  if (didClear) state.cleared += 1;
  write();
  return state;
}

export function reset() {
  cache = { ...DEFAULTS, settings: { ...DEFAULTS.settings }, lore: [] };
  try { localStorage.removeItem(CONFIG.saveKey); } catch { /* ignore */ }
  write();
  return cache;
}
