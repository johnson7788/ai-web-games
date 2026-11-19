// 存档：走 Sdk.save/load 封装（SDK 不可用时 SDK 内部落 localStorage）。
import Sdk from './sdk.js';

const KEY = 'save';

export const save = {
  data: {},

  load() {
    this.data = Sdk.load(KEY, {}) || {};
    return this.data;
  },

  set(key, value) {
    this.data[key] = value;
    Sdk.save(KEY, this.data);
  },

  get(key, defaultValue = null) {
    return this.data[key] ?? defaultValue;
  },
};

save.load();
