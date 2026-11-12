// 可注入 seed 的确定性随机源（mulberry32）：纯逻辑层唯一随机出口。
export function makeRng(seed = 1) {
  let s = (Math.trunc(Number(seed) || 0) >>> 0) || 0x9e3779b9;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    sign: () => (next() < 0.5 ? -1 : 1),
  };
}

export function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(rng.next() * (i + 1)));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}
