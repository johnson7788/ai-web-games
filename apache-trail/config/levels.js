// APACHE TRAIL · 关卡数据（纯数据，sim 读取）。
// 坐标：世界 1280×720，y 向下，y=HUD_H(56) 以上为 HUD 区。
// 平台/机关/水晶均为 AABB {x,y,w,h}；y 为顶边。
// 移动类机关（saw/boulder/tumble）在 p1↔p2 之间 ping-pong。
// spawn/end 的 y 为玩家「脚底」高度（站在地面上）。

const GROUND_Y = 660;

export const LEVEL_COUNT = 3;

export const LEVELS = [
  {
    id: 1,
    name: { en: 'Sunrise Mesa', zh: '日出台地' },
    time: 60,
    par: 32,
    spawn: { x: 70, y: GROUND_Y },
    end: { x: 1185, y: GROUND_Y },
    platforms: [
      { x: 0, y: GROUND_Y, w: 520, h: 120 },
      { x: 560, y: GROUND_Y, w: 240, h: 120 },
      { x: 850, y: GROUND_Y, w: 430, h: 120 },
    ],
    hazards: [
      { type: 'spike', x: 360, y: GROUND_Y - 14, w: 34, h: 14 },
    ],
    crystals: [
      { x: 150, y: 625 },
      { x: 300, y: 625 },
      { x: 470, y: 625 },
      { x: 620, y: 625 },
      { x: 715, y: 625 },
      { x: 900, y: 625 },
      { x: 1050, y: 625 },
      { x: 1120, y: 625 },
    ],
    powerups: [
      { type: 'shield', x: 250, y: 610 },
      { type: 'time', x: 980, y: 610 },
    ],
    springs: [],
    winds: [],
  },
  {
    id: 2,
    name: { en: 'Wind Canyon', zh: '风之峡谷' },
    time: 70,
    par: 40,
    spawn: { x: 70, y: GROUND_Y },
    end: { x: 1185, y: GROUND_Y },
    platforms: [
      { x: 0, y: GROUND_Y, w: 400, h: 120 },
      { x: 446, y: GROUND_Y, w: 254, h: 120 },
      { x: 746, y: GROUND_Y, w: 534, h: 120 },
      // 风之峡谷奖励高台（锯盘守着）
      { x: 900, y: 540, w: 160, h: 18 },
    ],
    hazards: [
      { type: 'spike', x: 560, y: GROUND_Y - 14, w: 34, h: 14 },
      { type: 'saw', x: 900, y: 494, w: 46, h: 46, p1: { x: 900, y: 494 }, p2: { x: 1044, y: 494 }, period: 2.2, phase: 0 },
    ],
    crystals: [
      { x: 150, y: 625 },
      { x: 300, y: 625 },
      { x: 480, y: 625 },
      { x: 600, y: 625 },
      { x: 800, y: 625 },
      { x: 950, y: 625 },
      { x: 1050, y: 625 },
      { x: 1150, y: 625 },
    ],
    powerups: [
      { type: 'time', x: 1050, y: 610 },
    ],
    springs: [
      { x: 200, y: GROUND_Y - 16, w: 60, h: 16, force: 18 },
    ],
    winds: [
      { x: 880, y: 580, w: 54, h: 60, dir: { x: -1, y: 0 }, interval: 2.0, duration: 2.0, phase: 1.0 },
    ],
  },
  {
    id: 3,
    name: { en: 'Boulder Pass', zh: '巨石隘口' },
    time: 80,
    par: 48,
    spawn: { x: 70, y: GROUND_Y },
    end: { x: 1185, y: GROUND_Y },
    platforms: [
      { x: 0, y: GROUND_Y, w: 400, h: 120 },
      { x: 446, y: GROUND_Y, w: 254, h: 120 },
      { x: 746, y: GROUND_Y, w: 534, h: 120 },
      // 高地平台（喷火间歇泉 + 滚刺球）
      { x: 80, y: 520, w: 160, h: 18 },
    ],
    hazards: [
      { type: 'spike', x: 600, y: GROUND_Y - 14, w: 34, h: 14 },
      { type: 'boulder', x: 900, y: 520, w: 64, h: 64, p1: { x: 900, y: 520 }, p2: { x: 1120, y: 520 }, period: 2.8, phase: 0 },
      { type: 'fire', x: 140, y: 504, w: 44, h: 16, interval: 1.6, duration: 1.4, phase: 0.8 },
      { type: 'tumble', x: 100, y: 476, w: 44, h: 44, p1: { x: 100, y: 476 }, p2: { x: 210, y: 476 }, period: 2.4, phase: 0 },
    ],
    crystals: [
      { x: 150, y: 625 },
      { x: 300, y: 625 },
      { x: 500, y: 625 },
      { x: 560, y: 625 },
      { x: 850, y: 625 },
      { x: 950, y: 625 },
      { x: 1050, y: 625 },
      { x: 1150, y: 625 },
    ],
    powerups: [
      { type: 'shield', x: 880, y: 610 },
    ],
    springs: [],
    winds: [],
  },
];

// 移动类机关类型（在 p1/p2 间 ping-pong）
export const MOVERS = ['saw', 'boulder', 'tumble'];
