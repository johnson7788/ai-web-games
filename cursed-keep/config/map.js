// 地图：敌人路径（像素折线）+ 可建造塔位。
export const PATH = [
  { x: -40, y: 160 },
  { x: 240, y: 160 },
  { x: 240, y: 420 },
  { x: 560, y: 420 },
  { x: 560, y: 160 },
  { x: 880, y: 160 },
  { x: 880, y: 480 },
  { x: 1120, y: 480 },
  { x: 1120, y: 300 },
  { x: 1320, y: 300 },
];

// 预计算路径累计长度，供敌人按距离行进。
export const PATH_SEGMENTS = (() => {
  const segs = [];
  let total = 0;
  for (let i = 0; i < PATH.length - 1; i += 1) {
    const a = PATH[i];
    const b = PATH[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segs.push({ a, b, len, start: total });
    total += len;
  }
  return { segs, total };
})();

// 由路径距离求坐标。
export function pointAt(dist) {
  const { segs, total } = PATH_SEGMENTS;
  const d = Math.max(0, Math.min(dist, total));
  for (const s of segs) {
    if (d <= s.start + s.len) {
      const t = (d - s.start) / s.len;
      return { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t };
    }
  }
  return { ...PATH[PATH.length - 1] };
}

export const PATH_LENGTH = PATH_SEGMENTS.total;

// 塔位（避开路径）。
export const SPOTS = [
  { x: 160, y: 80 }, { x: 160, y: 300 },
  { x: 360, y: 80 }, { x: 360, y: 300 },
  { x: 480, y: 540 }, { x: 480, y: 80 },
  { x: 680, y: 80 }, { x: 680, y: 300 },
  { x: 760, y: 540 }, { x: 800, y: 300 },
  { x: 1000, y: 80 }, { x: 1000, y: 300 },
  { x: 1040, y: 560 }, { x: 1200, y: 420 },
];