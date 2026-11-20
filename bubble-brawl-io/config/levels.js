// 关卡配置。每关：核心血量 / 圆环障碍 / 岩石 / 核心还击频率 / 三星标准。
// 圆环 gapArc 为每个缺口的全弧角（度），每个圆环有 2 个对向缺口，缺口垂直时才能打穿。
export const LEVELS = [
  {
    index: 1,
    coreHp: 300,
    rocks: 0,
    spikeInterval: 3.6,   // 核心还击间隔（秒）
    spikeSpeed: 250,
    par: 7,               // 三星：≤7 发
    unlock: null,
    rings: [
      { radius: 250, speed: 0.6, dir: 1, gapArc: 70, phase: 90 },
    ],
  },
  {
    index: 2,
    coreHp: 600,
    rocks: 0,
    spikeInterval: 3.2,
    spikeSpeed: 270,
    par: 14,
    unlock: 'inner-ring',
    rings: [
      { radius: 250, speed: 0.8, dir: 1, gapArc: 64, phase: 90 },
      { radius: 150, speed: 1.6, dir: -1, gapArc: 56, phase: 90 },
    ],
  },
  {
    index: 3,
    coreHp: 900,
    rocks: 2,
    spikeInterval: 3.0,
    spikeSpeed: 285,
    par: 20,
    unlock: 'rocks',
    rings: [
      { radius: 250, speed: 1.0, dir: 1, gapArc: 60, phase: 90 },
      { radius: 150, speed: 1.6, dir: -1, gapArc: 52, phase: 90 },
    ],
  },
  {
    index: 4,
    coreHp: 1200,
    rocks: 3,
    spikeInterval: 2.8,
    spikeSpeed: 300,
    par: 26,
    unlock: null,
    rings: [
      { radius: 250, speed: 1.2, dir: 1, gapArc: 56, phase: 90 },
      { radius: 150, speed: 2.0, dir: -1, gapArc: 48, phase: 90 },
    ],
  },
  {
    index: 5,
    coreHp: 1600,
    rocks: 3,
    spikeInterval: 2.6,
    spikeSpeed: 320,
    par: 34,
    unlock: null,
    rings: [
      { radius: 250, speed: 1.4, dir: -1, gapArc: 52, phase: 90 },
      { radius: 150, speed: 2.4, dir: 1, gapArc: 46, phase: 90 },
    ],
  },
  {
    index: 6,
    coreHp: 2000,
    rocks: 4,
    spikeInterval: 2.4,
    spikeSpeed: 340,
    par: 42,
    unlock: null,
    rings: [
      { radius: 250, speed: 1.6, dir: 1, gapArc: 50, phase: 90 },
      { radius: 150, speed: 2.8, dir: -1, gapArc: 44, phase: 90 },
    ],
  },
  {
    index: 7,
    coreHp: 2500,
    rocks: 4,
    spikeInterval: 2.2,
    spikeSpeed: 360,
    par: 50,
    unlock: null,
    rings: [
      { radius: 250, speed: 1.8, dir: -1, gapArc: 48, phase: 90 },
      { radius: 150, speed: 3.2, dir: 1, gapArc: 42, phase: 90 },
    ],
  },
  {
    index: 8,
    coreHp: 3000,
    rocks: 5,
    spikeInterval: 2.0,
    spikeSpeed: 380,
    par: 58,
    unlock: null,
    rings: [
      { radius: 250, speed: 2.0, dir: 1, gapArc: 46, phase: 90 },
      { radius: 150, speed: 3.6, dir: -1, gapArc: 40, phase: 90 },
    ],
  },
];

export function getLevel(index) {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, index))];
}
