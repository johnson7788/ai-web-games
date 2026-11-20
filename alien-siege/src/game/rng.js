// mulberry32：确定性 PRNG（同 seed 同结果），纯逻辑零依赖
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 整数 [a, b]（两端都含）
export function randInt(rng, a, b) {
  return a + Math.floor(rng() * (b - a + 1));
}
