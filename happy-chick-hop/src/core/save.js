// 存档统一走 Sdk.save/load（SDK 不可用时自动落 localStorage 兜底）。
import Sdk from './sdk.js';

export const save = {
  get(key, fallback = null) {
    return Sdk.load(key, fallback);
  },
  set(key, value) {
    return Sdk.save(key, value);
  },
};
