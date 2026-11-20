// 纯逻辑伪随机：mulberry32（seed 可复现，测试用同一 seed 得到同一棋盘）
export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
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
