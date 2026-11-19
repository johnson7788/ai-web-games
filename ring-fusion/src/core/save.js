// 存档：走 Sdk.save/load 封装（其内部未接 SDK 时降级 localStorage），
// 再兜底一次 localStorage / 内存，保证隐私模式与断网也能存。
import { CONFIG } from '../../config/game.config.js';
import Sdk from './sdk.js';

export const save = {
  data: {},

  load() {
    let obj = null;
    try { obj = Sdk.load(CONFIG.saveKey); } catch { /* noop */ }
    if (!obj || typeof obj !== 'object') {
      try {
        const raw = window.localStorage.getItem(CONFIG.saveKey);
        if (raw) obj = JSON.parse(raw);
      } catch { /* noop */ }
    }
    this.data = obj && typeof obj === 'object' ? obj : {};
    return this.data;
  },

  persist() {
    try { Sdk.save(CONFIG.saveKey, this.data); } catch { /* noop */ }
    try { window.localStorage.setItem(CONFIG.saveKey, JSON.stringify(this.data)); } catch { /* noop */ }
  },

  set(key, value) {
    this.data[key] = value;
    this.persist();
  },

  get(key, defaultValue = null) {
    return this.data[key] ?? defaultValue;
  },
};

save.load();
