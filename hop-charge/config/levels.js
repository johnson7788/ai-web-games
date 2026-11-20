// HOP CHARGE · 关卡数据（Lead 拥有）
// 契约：docs/README.md §4（12 关 3 章逐字落实）。
// 字段：index/scene/goalJumps/timeLimit/spacing/typeCycle/wind/types。
// 每关一个新元素：固定间距 → 渐远 → 渐近 → 移动台 → 弹簧台 → 冰面台 → 断头台 → 逆风段 → 综合 ×4。
// 平台由 sim 依据 spacing + typeCycle 从 seed 确定性生成；start 台（index 0）永远是普通台。

export const LEVELS = [
  {
    index: 1, scene: 'dusk-town', goalJumps: 3, timeLimit: 40,
    spacing: { kind: 'fixed', base: 320, step: 0, min: 260, max: 520, variance: 0 },
    typeCycle: ['normal'], wind: false,
    newElement: '固定间距：按住蓄力，松开跳到下一片屋顶',
  },
  {
    index: 2, scene: 'dusk-town', goalJumps: 4, timeLimit: 42,
    spacing: { kind: 'farther', base: 300, step: 40, min: 260, max: 520, variance: 0 },
    typeCycle: ['normal'], wind: false,
    newElement: '渐远间距：下一片屋顶越飞越远',
  },
  {
    index: 3, scene: 'dusk-town', goalJumps: 4, timeLimit: 42,
    spacing: { kind: 'nearer', base: 460, step: -40, min: 260, max: 520, variance: 0 },
    typeCycle: ['normal'], wind: false,
    newElement: '渐近间距：屋顶突然收近，力度要重新校准',
  },
  {
    index: 4, scene: 'dusk-town', goalJumps: 5, timeLimit: 45,
    spacing: { kind: 'fixed', base: 360, step: 0, min: 260, max: 520, variance: 0 },
    typeCycle: ['normal', 'moving'], wind: false,
    newElement: '移动台：左右缓动，看准时机再落',
  },
  {
    index: 5, scene: 'rainy-street', goalJumps: 5, timeLimit: 45,
    spacing: { kind: 'fixed', base: 340, step: 0, min: 260, max: 520, variance: 0 },
    typeCycle: ['normal', 'spring'], wind: false,
    newElement: '弹簧台：落上弹更远（省力但有横偏）',
  },
  {
    index: 6, scene: 'rainy-street', goalJumps: 5, timeLimit: 45,
    spacing: { kind: 'fixed', base: 340, step: 0, min: 260, max: 520, variance: 0 },
    typeCycle: ['normal', 'ice'], wind: false,
    newElement: '冰面台：落点会滑半格，逼你留余量',
  },
  {
    index: 7, scene: 'rainy-street', goalJumps: 6, timeLimit: 48,
    spacing: { kind: 'fixed', base: 300, step: 0, min: 260, max: 520, variance: 0 },
    typeCycle: ['normal', 'narrow'], wind: false,
    newElement: '断头台：边缘更窄，判定更凶',
  },
  {
    index: 8, scene: 'rainy-street', goalJumps: 6, timeLimit: 48,
    spacing: { kind: 'fixed', base: 340, step: 0, min: 260, max: 520, variance: 0 },
    typeCycle: ['normal'], wind: true,
    newElement: '逆风段：跳跃被阻力吃距离，必须多蓄',
  },
  {
    index: 9, scene: 'misty-peak', goalJumps: 7, timeLimit: 52,
    spacing: { kind: 'varying', base: 340, step: 0, min: 260, max: 520, variance: 80 },
    typeCycle: ['normal', 'moving', 'spring'], wind: false,
    newElement: '综合：移动台 + 弹簧台',
  },
  {
    index: 10, scene: 'misty-peak', goalJumps: 7, timeLimit: 52,
    spacing: { kind: 'fixed', base: 300, step: 0, min: 260, max: 520, variance: 0 },
    typeCycle: ['normal', 'ice', 'narrow'], wind: false,
    newElement: '综合：冰面台 + 断头台',
  },
  {
    index: 11, scene: 'misty-peak', goalJumps: 8, timeLimit: 55,
    spacing: { kind: 'fixed', base: 340, step: 0, min: 260, max: 520, variance: 0 },
    typeCycle: ['normal', 'spring'], wind: true,
    newElement: '综合：弹簧台 + 逆风',
  },
  {
    index: 12, scene: 'misty-peak', goalJumps: 10, timeLimit: 60,
    spacing: { kind: 'varying', base: 330, step: 0, min: 260, max: 520, variance: 90 },
    typeCycle: ['moving', 'spring', 'ice', 'narrow'], wind: true,
    newElement: '大师关：移动 + 弹簧 + 冰面 + 断头 + 逆风五轴叠加',
  },
];

export const LEVEL_COUNT = LEVELS.length;

// 平台宽（世界像素）按类型；断头台更窄。
export const PLATFORM_W = {
  start: 130,
  normal: 120,
  moving: 120,
  spring: 120,
  ice: 120,
  narrow: 70,
};
