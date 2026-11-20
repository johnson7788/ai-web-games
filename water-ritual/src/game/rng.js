// src/game/rng.js — 可复现随机（纯逻辑，无 DOM/无 Date）。
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
