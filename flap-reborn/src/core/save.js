// 存档：统一走 Sdk.save/load（SDK 不可用时 Sdk 内部已降级到 localStorage）。
import Sdk from './sdk.js';

export const save = {
  data: {},

  load() {
    this.data = Sdk.load('data', {}) || {};
    return this.data;
  },

  get(key, defaultValue = null) {
    return this.data[key] ?? defaultValue;
  },

  set(key, value) {
    this.data[key] = value;
    Sdk.save('data', this.data);
  },
};

save.load();
