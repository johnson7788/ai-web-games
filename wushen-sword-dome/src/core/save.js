// 存档统一出口：走 Sdk.save/load（SDK 不可用时由 Sdk 内部降级到 localStorage）。
import { Sdk } from './sdk.js';

export const save = {
  load(key, fallback = null) {
    return Sdk.load(key, fallback);
  },
  set(key, value) {
    return Sdk.save(key, value);
  },
  get(key, fallback = null) {
    return Sdk.load(key, fallback);
  },
};
