// 存档：统一走 Sdk.save/load（内部已含 localStorage 降级），业务禁止直碰 localStorage。
import { Sdk } from './sdk.js';

export const save = {
  get(key, defaultValue = null) {
    return Sdk.load(key, defaultValue);
  },
  set(key, value) {
    Sdk.save(key, value);
  },
  getBest() {
    const v = Sdk.load('best', 0);
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  },
  setBest(v) {
    Sdk.save('best', v);
  },
  getUnlocked() {
    const v = Sdk.load('unlocked', 1);
    return typeof v === 'number' && Number.isFinite(v) ? v : 1;
  },
  setUnlocked(v) {
    Sdk.save('unlocked', v);
  },
};
