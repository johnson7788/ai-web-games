// 存档封装：统一走 Sdk.save/load（Sdk 内部自带 localStorage 降级）。
// 业务代码只碰这个模块，不直写 localStorage。
import { Sdk } from './sdk.js';

const KEY = 'profile';

export const save = {
  data: {},

  load() {
    this.data = Sdk.load(KEY, {}) || {};
    return this.data;
  },

  get(key, defaultValue = null) {
    return this.data[key] ?? defaultValue;
  },

  set(key, value) {
    this.data[key] = value;
    Sdk.save(KEY, this.data);
  },

  flush() {
    Sdk.save(KEY, this.data);
  },
};

save.load();
