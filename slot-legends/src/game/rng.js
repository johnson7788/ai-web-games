// src/game/rng.js — 可复现伪随机（mulberry32）。sim 纯逻辑用 seed 注入，测试可复现。
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

/** 按权重表取一个 key（入参 { key: weight }，返回 key 字符串）。 */
export function weightedPick(rng, weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  let total = 0;
  for (const [, w] of entries) total += w;
  let roll = rng() * total;
  for (const [k, w] of entries) {
    roll -= w;
    if (roll <= 0) return k;
  }
  return entries[entries.length - 1][0];
}
