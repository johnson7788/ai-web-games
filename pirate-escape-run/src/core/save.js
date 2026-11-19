// 存档：统一走 Sdk.save / Sdk.load（localStorage 仅作为 SDK 降级时的兜底，由 sdk.js 内部处理）。
import Sdk from './sdk.js';

export const save = {
  load(key, fallback = null) {
    return Sdk.load(key, fallback);
  },
  set(key, value) {
    Sdk.save(key, value);
  },
  get(key, fallback = null) {
    return Sdk.load(key, fallback);
  },
};

export default save;
