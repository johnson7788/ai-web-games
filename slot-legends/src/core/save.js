// src/core/save.js — localStorage 安全降级存档（仅用于非存档类临时配置；业务存档走 Sdk）
import { CONFIG } from '../../config/game.config.js';

const saveKey = CONFIG.saveKey;

export const save = {
  data: {},

  load() {
    try {
      const raw = localStorage.getItem(saveKey);
      this.data = raw ? JSON.parse(raw) : {};
    } catch {
      this.data = {};
    }
    return this.data;
  },

  set(key, value) {
    this.data[key] = value;
    try {
      localStorage.setItem(saveKey, JSON.stringify(this.data));
    } catch {
      // ignore
    }
  },

  get(key, defaultValue = null) {
    return this.data[key] ?? defaultValue;
  },
};

save.load();
