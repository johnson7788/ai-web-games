// src/core/save.js — 存档统一走 Sdk.save/load 封装（Sdk 内部已带 localStorage 降级）。
// 业务代码不直接碰 localStorage。
import { Sdk } from './sdk.js';
import { CONFIG } from '../../config/game.config.js';

const SAVE_KEY = CONFIG.saveKey;

export const save = {
  data: {},

  load() {
    this.data = Sdk.load(SAVE_KEY, {}) || {};
    if (typeof this.data !== 'object') this.data = {};
    return this.data;
  },

  get(key, defaultValue = null) {
    return this.data[key] ?? defaultValue;
  },

  set(key, value) {
    this.data[key] = value;
    Sdk.save(SAVE_KEY, this.data);
    return value;
  },
};

save.load();
