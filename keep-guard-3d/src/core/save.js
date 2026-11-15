// src/core/save.js — 存档唯一出口：业务只经 Sdk.save/load（隐私模式静默降级）。
import { Sdk } from './sdk.js';
import { CONFIG } from '../../config/game.config.js';

const PROFILE_KEY = 'profile';

export const save = {
  data: {},
  load() {
    const v = Sdk.load(PROFILE_KEY, null);
    this.data = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    return this.data;
  },
  set(key, value) {
    this.data[key] = value;
    Sdk.save(PROFILE_KEY, this.data);
  },
  get(key, defaultValue = null) {
    return this.data[key] ?? defaultValue;
  },
};

save.load();
