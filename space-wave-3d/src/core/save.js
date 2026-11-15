// src/core/save.js — 存档只经 Sdk.save/load（SDK 缺失时 Sdk 内部落 localStorage）
import { Sdk } from './sdk.js';

export const save = {
  data: {},
  load() { this.data = Sdk.load('save', {}) || {}; return this.data; },
  set(key, value) { this.data[key] = value; Sdk.save('save', this.data); },
  get(key, defaultValue = null) { return this.data[key] ?? defaultValue; },
};

save.load();
