// 存档：统一走 Sdk.save/load 封装；SDK 不可用时 Sdk 内部已降级到 localStorage。
import { Sdk } from './sdk.js';

const KEY = 'save';

export const save = {
  data: {},

  load() {
    const v = Sdk.load(KEY, {});
    this.data = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
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
