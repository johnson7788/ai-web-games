// src/game/rng.js — 可复现的伪随机数（mulberry32），纯逻辑、无 DOM
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 取 [min, max] 闭区间整数 */
export function rngInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** 取数组随机元素 */
export function rngPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
