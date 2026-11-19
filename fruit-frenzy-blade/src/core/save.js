// 存档出口：统一走 Sdk.save/load（SDK 不可用时 Sdk 内部自动落 localStorage）。
// 业务代码不直接碰 localStorage，只通过这里。
import { Sdk } from './sdk.js';

const KEYS = {
  best: 'best',
  tutorialDone: 'tutorialDone',
  muted: 'muted',
};

export const save = {
  get(key, fallback = null) {
    const v = Sdk.load(key, fallback);
    return v === undefined ? fallback : v;
  },

  set(key, value) {
    Sdk.save(key, value);
    return value;
  },

  best() {
    const v = this.get(KEYS.best, 0);
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  },

  setBest(score) {
    if (score > this.best()) this.set(KEYS.best, score);
    return this.best();
  },

  tutorialDone() {
    return this.get(KEYS.tutorialDone, false) === true;
  },

  markTutorialDone() {
    this.set(KEYS.tutorialDone, true);
  },

  muted() {
    return this.get(KEYS.muted, false) === true;
  },

  setMuted(m) {
    this.set(KEYS.muted, !!m);
    return !!m;
  },
};

export { KEYS };
