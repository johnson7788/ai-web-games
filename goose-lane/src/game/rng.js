// src/game/rng.js — 可复现的确定性随机（纯逻辑，无 DOM/Date.now）
export function mulberry32(seed = 0) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng, lo, hi) {
  const [a, b] = lo <= hi ? [lo, hi] : [hi, lo];
  return Math.floor(rng() * (b - a + 1)) + a;
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function chance(rng, p) {
  return rng() < p;
}
