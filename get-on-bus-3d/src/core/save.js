// GET ON BUS 3D · 存档封装：走 Sdk.save/load（localStorage 仅作为 SDK 降级）。
import { Sdk } from './sdk.js';

const KEYS = {
  progress: 'progress', // { stars: {[levelIndex]: number}, bestCoins: number }
  muted: 'muted',
};

export const save = {
  load(key, fallback = null) {
    return Sdk.load(`${key}`, fallback);
  },

  set(key, value) {
    return Sdk.save(`${key}`, value);
  },

  // 关卡进度：解锁到第一关未满星的关卡；解锁规则 = 第 i 关解锁需 i-1 关满 ≥1 星
  getProgress() {
    const p = this.load(KEYS.progress, {});
    const stars = p.stars || {};
    return {
      stars: Object.fromEntries(Object.entries(stars).map(([k, v]) => [Number(k), v])),
      bestCoins: p.bestCoins || 0,
      unlocked: (() => {
        const out = {};
        for (let i = 0; i < 10; i += 1) {
          out[i] = i === 0 ? true : (stars[i - 1] || 0) >= 1;
        }
        return out;
      })(),
    };
  },

  // 记录一关成绩（返回是否为新高分）
  recordLevel(levelIndex, stars, coins) {
    const p = this.load(KEYS.progress, {});
    const starsMap = p.stars || {};
    const prev = starsMap[levelIndex] || 0;
    starsMap[levelIndex] = Math.max(prev, stars);
    const bestCoins = Math.max(p.bestCoins || 0, coins);
    this.set(KEYS.progress, { stars: starsMap, bestCoins });
    return stars > prev;
  },

  isMuted() {
    return this.load(KEYS.muted, false) === true;
  },
  setMuted(v) {
    this.set(KEYS.muted, !!v);
  },
};
