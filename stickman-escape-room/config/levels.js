// STICKMAN ESCAPE ROOM · 关卡定义（数值与每关新元素）
// 每关：安全缺口数量 / 倒计时 / 天花板下落时长 / 岩石墙 / 熔岩 / 道具。
export const LEVELS = [
  {
    index: 1,
    name: { en: 'First Crack', zh: '第一道裂口' },
    safeMin: 2, safeMax: 2,
    countdown: 3.6, descendTime: 1.0,
    rocks: [], hazards: [], powers: ['gem'], gemCount: 1,
  },
  {
    index: 2,
    name: { en: 'Shorter Breath', zh: '更短的喘息' },
    safeMin: 2, safeMax: 2,
    countdown: 3.0, descendTime: 0.95,
    rocks: [], hazards: [], powers: ['gem'], gemCount: 2,
  },
  {
    index: 3,
    name: { en: 'Fallen Walls', zh: '塌落的墙壁' },
    safeMin: 2, safeMax: 2,
    countdown: 2.8, descendTime: 0.9,
    rocks: [0], hazards: [], powers: ['gem'], gemCount: 1,
  },
  {
    index: 4,
    name: { en: 'Lava Floor', zh: '熔岩地板' },
    safeMin: 2, safeMax: 2,
    countdown: 2.6, descendTime: 0.85,
    rocks: [], hazards: [], powers: ['gem'], gemCount: 1, hazardsCount: 2,
  },
  {
    index: 5,
    name: { en: 'Tools Appear', zh: '道具出现' },
    safeMin: 2, safeMax: 2,
    countdown: 2.4, descendTime: 0.8,
    rocks: [8], hazards: [], powers: ['gem', 'shield', 'slow'], gemCount: 1, hazardsCount: 1,
  },
  {
    index: 6,
    name: { en: 'One Exit', zh: '唯一的出口' },
    safeMin: 1, safeMax: 1,
    countdown: 2.3, descendTime: 0.75,
    rocks: [0, 8], hazards: [], powers: ['gem', 'shield'], gemCount: 1, hazardsCount: 2,
  },
  {
    index: 7,
    name: { en: 'Racing Walls', zh: '两面包夹' },
    safeMin: 1, safeMax: 1,
    countdown: 2.2, descendTime: 0.7,
    rocks: [6], hazards: [], powers: ['shield', 'slow'], gemCount: 1, hazardsCount: 2,
  },
  {
    index: 8,
    name: { en: 'Last Door', zh: '最后的大门' },
    safeMin: 1, safeMax: 1,
    countdown: 2.0, descendTime: 0.65,
    rocks: [0, 8], hazards: [], powers: ['gem', 'shield', 'slow'], gemCount: 2, hazardsCount: 2,
  },
];

export const LEVEL_COUNT = LEVELS.length;
