// localStorage 安全降级存档（注意：业务存档统一走 src/core/sdk.js；此文件仅供 audio 等内部设置用）
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
