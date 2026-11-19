// 存档统一走 Sdk 封装（SDK 不可用时自动落 localStorage；直写仅在 SDK 内部降级）。
import Sdk from './sdk.js';

export const save = {
  load(key, fallback = null) {
    return Sdk.load(key, fallback);
  },
  set(key, value) {
    Sdk.save(key, value);
  },
};

export default save;
