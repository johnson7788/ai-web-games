// 存档统一走 SDK 出口（Sdk.save/load），SDK 不可用时内部已降级 localStorage。
import { Sdk } from './sdk.js';

export const save = {
  get(key, fallback = null) {
    return Sdk.load(key, fallback);
  },
  set(key, value) {
    Sdk.save(key, value);
    return value;
  },
};
