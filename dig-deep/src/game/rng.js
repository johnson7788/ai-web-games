// src/game/rng.js — 可复现的种子随机（纯逻辑，无 Math.random）
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

/** 从整数权重表抽样（{a:10, b:20} → 'a' 概率 10/30）。 */
export function weighted(rng, table) {
  let total = 0;
  for (const k in table) total += table[k] > 0 ? table[k] : 0;
  if (total <= 0) return null;
  let r = rng() * total;
  for (const k in table) {
    const w = table[k] > 0 ? table[k] : 0;
    r -= w;
    if (r < 0) return k;
  }
  return null;
}
