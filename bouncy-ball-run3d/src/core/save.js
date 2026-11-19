// 存档统一走 Sdk.save/load（SDK 不可用时 Sdk 内部自动降级 localStorage）。
// 业务代码不直接碰 localStorage / window.PipyGames。
import Sdk from './sdk.js';

export const save = {
  get(key, fallback = null) {
    return Sdk.load(key, fallback);
  },
  set(key, value) {
    return Sdk.save(key, value);
  },
};
