// 存档统一走 Sdk.save/load（SDK 不可用时 Sdk 内部落 localStorage，仅此降级路径）。
import Sdk from './sdk.js';

export const save = {
  get(key, fallback = null) {
    return Sdk.load(key, fallback);
  },
  set(key, value) {
    Sdk.save(key, value);
  },
  int(key, fallback = 0) {
    const v = Sdk.load(key, null);
    if (v === null || v === undefined) return fallback;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
  },
  bool(key, fallback = false) {
    const v = Sdk.load(key, null);
    if (v === null || v === undefined) return fallback;
    return v === true || v === 'true' || v === 1 || v === '1';
  },
};

export default save;
