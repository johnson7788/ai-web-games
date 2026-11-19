// 存档：统一走 Sdk.save/load（SDK 不可用时落 localStorage），业务代码不直接碰 localStorage。
import { Sdk } from './sdk.js';

export const save = {
  data: {},

  load() {
    this.data = Sdk.load('save', {});
    if (!this.data || typeof this.data !== 'object') this.data = {};
    return this.data;
  },

  set(key, value) {
    this.data[key] = value;
    Sdk.save('save', this.data);
  },

  get(key, defaultValue = null) {
    return this.data[key] ?? defaultValue;
  },
};

save.load();
