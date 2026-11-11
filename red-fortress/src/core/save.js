// 存档：localStorage 安全降级；隐私模式/配额满不崩。
import { SAVE_KEY } from '../../config/game.config.js';

const DEFAULTS = {
  bestScore: 0,
  bestStage: 0,
  totalRescued: 0,
  cleared: false,
  runs: 0,
  settings: {
    music: 0.7,
    sfx: 0.8,
    muted: false,
    shake: true,
    quality: 'high',
  },
};

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function load() {
  let raw = null;
  try {
    raw = window.localStorage.getItem(SAVE_KEY);
  } catch {
    raw = null;
  }
  let data = clone(DEFAULTS);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      data = {
        ...data,
        ...parsed,
        settings: { ...data.settings, ...(parsed.settings || {}) },
      };
    } catch {
      data = clone(DEFAULTS);
    }
  }
  return data;
}

export const save = {
  data: load(),

  reload() {
    this.data = load();
    return this.data;
  },

  get(key, fallback = null) {
    return this.data[key] ?? fallback;
  },

  set(key, value) {
    this.data[key] = value;
    this.persist();
    return value;
  },

  patch(partial) {
    Object.assign(this.data, partial);
    this.persist();
  },

  settings() {
    return this.data.settings;
  },

  setSetting(key, value) {
    this.data.settings[key] = value;
    this.persist();
    return value;
  },

  persist() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      /* 隐私模式：内存里保留，不崩 */
    }
  },

  reset() {
    this.data = clone(DEFAULTS);
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
    this.persist();
    return this.data;
  },
};
