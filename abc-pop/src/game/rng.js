// 确定性伪随机（mulberry32）：sim/selfplay 可复现。
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

export function randRange(rng, lo, hi) {
  return lo + (hi - lo) * rng();
}

export function randInt(rng, lo, hi) {
  return Math.floor(randRange(rng, lo, hi + 1));
}
