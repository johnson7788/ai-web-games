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

// 从数组随机取一个
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// 洗牌（Fisher–Yates，返回新数组）
export function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
