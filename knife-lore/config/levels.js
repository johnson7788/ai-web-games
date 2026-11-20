// KNIFE LORE · 12 关定义
// 三大场景包：竹庭（绿，1-4）/ 暮城（朱红，5-8）/ 雪岳（蓝白，9-12）
// 桩形：圆 / 方 / 双桩 / 移动桩；推进：转速 / 间歇反转 / 加速脉冲；刀数 5→12。

export const PACKS = {
  bamboo: { index: 1, name: 'pack.bamboo' },
  dusk: { index: 2, name: 'pack.dusk' },
  snow: { index: 3, name: 'pack.snow' },
};

export const LEVELS = [
  {
    index: 1, knives: 5, speedDeg: 60, dir: 1, shape: 'circle', mode: 'basic',
    pack: 'bamboo', zantie: false,
  },
  {
    index: 2, knives: 6, speedDeg: 82, dir: 1, shape: 'circle', mode: 'pulse',
    pack: 'bamboo', zantie: false, pulse: { every: 2.5, dur: 0.7, boost: 1.8 },
  },
  {
    index: 3, knives: 6, speedDeg: 70, dir: -1, shape: 'square', mode: 'reversal',
    pack: 'bamboo', zantie: true, reversal: { every: 2.8 },
  },
  {
    index: 4, knives: 7, speedDeg: 92, dir: 1, shape: 'square', mode: 'pulseReversal',
    pack: 'bamboo', zantie: false, pulse: { every: 3.0, dur: 0.7, boost: 1.7 }, reversal: { every: 3.4 },
  },
  {
    index: 5, knives: 7, speedDeg: 70, dir: 1, shape: 'dual', mode: 'basic',
    pack: 'dusk', zantie: false,
  },
  {
    index: 6, knives: 8, speedDeg: 86, dir: 1, shape: 'dual', mode: 'reversal',
    pack: 'dusk', zantie: false, reversal: { every: 2.6 },
  },
  {
    index: 7, knives: 8, speedDeg: 80, dir: 1, shape: 'dual', mode: 'pulse',
    pack: 'dusk', zantie: true, pulse: { every: 2.4, dur: 0.8, boost: 1.9 },
  },
  {
    index: 8, knives: 9, speedDeg: 100, dir: 1, shape: 'dual', mode: 'pulseReversal',
    pack: 'dusk', zantie: false, pulse: { every: 2.8, dur: 0.8, boost: 1.7 }, reversal: { every: 3.2 },
  },
  {
    index: 9, knives: 9, speedDeg: 80, dir: 1, shape: 'moving', mode: 'basic',
    pack: 'snow', zantie: true,
  },
  {
    index: 10, knives: 10, speedDeg: 90, dir: -1, shape: 'moving', mode: 'reversal',
    pack: 'snow', zantie: false, reversal: { every: 2.9 },
  },
  {
    index: 11, knives: 11, speedDeg: 96, dir: 1, shape: 'moving', mode: 'pulse',
    pack: 'snow', zantie: false, pulse: { every: 2.2, dur: 0.9, boost: 1.8 },
  },
  {
    index: 12, knives: 12, speedDeg: 112, dir: 1, shape: 'moving', mode: 'pulseReversal',
    pack: 'snow', zantie: true, pulse: { every: 2.6, dur: 0.9, boost: 1.8 }, reversal: { every: 3.0 },
  },
];

export const LEVEL_COUNT = LEVELS.length;

export function levelAt(index) {
  const n = Math.max(1, Math.min(LEVEL_COUNT, Math.round(index)));
  return LEVELS[n - 1];
}

// 桩形集合（供渲染 / 测试枚举）
export const SHAPES = ['circle', 'square', 'dual', 'moving'];
export const MODES = ['basic', 'pulse', 'reversal', 'pulseReversal'];
