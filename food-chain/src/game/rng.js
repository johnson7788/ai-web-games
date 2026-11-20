// src/game/rng.js — 可复现伪随机（mulberry32）+ 常用采样（纯逻辑，零依赖）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randFloat(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

export function randInt(rng, lo, hi) {
  return Math.floor(randFloat(rng, lo, hi + 1));
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
