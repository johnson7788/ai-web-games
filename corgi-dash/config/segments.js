// CORGI DASH · 12 段推进结构 + 3 场景包
// 每段：endM 距离目标 / gap 障碍间距范围（px）/ obstacles 允许障碍类型 / decor 场景包 / newElement（供 design.json 对齐）
// 场景包：meadow 晨雾草原（青绿）→ wheat 麦浪（金）→ storm 暴雨山丘（蓝灰）；换章必换色板+构图+装饰。

export const SEGMENTS = [
  { index: 1,  endM: 400,  gapMin: 560, gapMax: 760, obstacles: ['fence'],                                    decor: 'meadow', nameKey: 'seg.1'  },
  { index: 2,  endM: 800,  gapMin: 540, gapMax: 740, obstacles: ['fence', 'hay'],                             decor: 'meadow', nameKey: 'seg.2'  },
  { index: 3,  endM: 1200, gapMin: 500, gapMax: 700, obstacles: ['fence', 'hay', 'puddle'],                   decor: 'meadow', nameKey: 'seg.3'  },
  { index: 4,  endM: 1600, gapMin: 480, gapMax: 680, obstacles: ['fence', 'hay', 'puddle', 'bridge'],         decor: 'meadow', nameKey: 'seg.4'  },
  { index: 5,  endM: 2000, gapMin: 460, gapMax: 660, obstacles: ['fence', 'hay', 'puddle', 'bridge', 'doubleFence'], decor: 'wheat', nameKey: 'seg.5'  },
  { index: 6,  endM: 2400, gapMin: 440, gapMax: 640, obstacles: ['hay', 'puddle', 'bridge', 'doubleFence', 'pen'],     decor: 'wheat', nameKey: 'seg.6'  },
  { index: 7,  endM: 2800, gapMin: 420, gapMax: 620, obstacles: ['hay', 'puddle', 'doubleFence', 'pen', 'row'],         decor: 'wheat', nameKey: 'seg.7'  },
  { index: 8,  endM: 3200, gapMin: 400, gapMax: 600, obstacles: ['fence', 'hay', 'bridge', 'doubleFence', 'pen', 'row'], decor: 'wheat', nameKey: 'seg.8'  },
  { index: 9,  endM: 3600, gapMin: 380, gapMax: 580, obstacles: ['hay', 'puddle', 'doubleFence', 'pen', 'row', 'fence'], decor: 'storm', nameKey: 'seg.9'  },
  { index: 10, endM: 4000, gapMin: 360, gapMax: 560, obstacles: ['hay', 'puddle', 'doubleFence', 'pen', 'row', 'bridge'], decor: 'storm', nameKey: 'seg.10' },
  { index: 11, endM: 4400, gapMin: 340, gapMax: 540, obstacles: ['fence', 'hay', 'puddle', 'bridge', 'doubleFence', 'pen', 'row'], decor: 'storm', nameKey: 'seg.11' },
  { index: 12, endM: 4800, gapMin: 320, gapMax: 520, obstacles: ['fence', 'hay', 'puddle', 'bridge', 'doubleFence', 'pen', 'row'], decor: 'storm', nameKey: 'seg.12' },
];

export const SEGMENT_COUNT = SEGMENTS.length;

// distance（米）→ segment（1-based；超过最后一关无限续跑）
export function segmentAt(distanceM) {
  for (const s of SEGMENTS) {
    if (distanceM < s.endM) return s.index;
  }
  return SEGMENTS[SEGMENTS.length - 1].index;
}

// distance（米）→ segment 对象
export function segmentFor(distanceM) {
  return SEGMENTS[segmentAt(distanceM) - 1];
}
