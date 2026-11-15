// config/levels.js — 5 关赛道（config-first）。赛道沿 +Z 前进，中心线 x=0，悬浮空中。
// segment: { from, to, width(halfWidth), y0, y1 }，y0!=y1 形成坡道。
// banana: { z, x, y? }（y 缺省 = 赛道表面 + 半径，供滚动穿过）
// hammer: { z, arm, freq, phase }  移动锤：绕头顶横摆，砸中击飞
// pad:    { z, halfWidth }         弹跳板：球弹起 3m
export const LEVELS = [
  {
    index: 1,
    name: { en: 'Sunny Start', zh: '阳光起步' },
    length: 300,
    spawn: { x: 0, z: 2 },
    checkpoints: [80, 180, 240],
    targetSec: 34,
    segments: [
      { from: 0, to: 120, width: 1.6, y0: 0, y1: 0 },
      { from: 120, to: 150, width: 1.6, y0: 0, y1: 1.8 },
      { from: 150, to: 182, width: 1.6, y0: 1.8, y1: 1.8 },
      { from: 182, to: 214, width: 1.6, y0: 1.8, y1: 0 },
      { from: 214, to: 300, width: 1.6, y0: 0, y1: 0 },
    ],
    bananas: [
      { z: 18, x: 0 }, { z: 34, x: -0.4 }, { z: 50, x: 0.4 }, { z: 66, x: 0 },
      { z: 82, x: -0.4 }, { z: 98, x: 0.4 }, { z: 112, x: 0 }, { z: 136, x: 0 },
      { z: 160, x: 0.4 }, { z: 190, x: -0.4 }, { z: 214, x: 0 }, { z: 244, x: 0.4 },
      { z: 268, x: 0 }, { z: 290, x: 0 },
    ],
    hammers: [],
    pads: [],
  },
  {
    index: 2,
    name: { en: 'Hammer Alley', zh: '锤子巷' },
    length: 320,
    spawn: { x: 0, z: 2 },
    checkpoints: [90, 180, 260],
    targetSec: 38,
    segments: [
      { from: 0, to: 320, width: 1.6, y0: 0, y1: 0 },
    ],
    bananas: [
      { z: 20, x: 0 }, { z: 42, x: 0 }, { z: 60, x: 0.4 }, { z: 78, x: -0.4 },
      { z: 96, x: 0 }, { z: 116, x: 0 }, { z: 134, x: 0.4 }, { z: 152, x: -0.4 },
      { z: 170, x: 0 }, { z: 190, x: 0 }, { z: 208, x: 0.4 }, { z: 226, x: -0.4 },
      { z: 244, x: 0 }, { z: 264, x: 0 }, { z: 286, x: 0 }, { z: 308, x: 0 },
    ],
    hammers: [
      { z: 90, arm: 1.5, freq: 1.5, phase: 0 },
      { z: 150, arm: 1.5, freq: 1.8, phase: 1.6 },
      { z: 230, arm: 1.5, freq: 1.6, phase: 3.1 },
    ],
    pads: [],
  },
  {
    index: 3,
    name: { en: 'Narrow Sky', zh: '窄桥天际' },
    length: 340,
    spawn: { x: 0, z: 2 },
    checkpoints: [100, 200, 280],
    targetSec: 42,
    segments: [
      { from: 0, to: 100, width: 1.6, y0: 0, y1: 0 },
      { from: 100, to: 150, width: 0.62, y0: 0, y1: 0 },   // 窄桥 1（1.2 球径）
      { from: 150, to: 190, width: 1.6, y0: 0, y1: 0 },
      { from: 190, to: 250, width: 0.62, y0: 0, y1: 0 },   // 窄桥 2
      { from: 250, to: 340, width: 1.6, y0: 0, y1: 0 },
    ],
    bananas: [
      { z: 20, x: 0 }, { z: 40, x: 0.4 }, { z: 60, x: -0.4 }, { z: 80, x: 0 },
      { z: 100, x: 0 }, { z: 110, x: 0 }, { z: 125, x: 0 }, { z: 140, x: 0 },
      { z: 165, x: 0.4 }, { z: 195, x: 0 }, { z: 205, x: 0 }, { z: 220, x: 0 },
      { z: 235, x: 0 }, { z: 265, x: 0.4 }, { z: 285, x: -0.4 }, { z: 305, x: 0 },
      { z: 325, x: 0 },
    ],
    hammers: [],
    pads: [],
  },
  {
    index: 4,
    name: { en: 'Bounce Blossom', zh: '弹跳花径' },
    length: 360,
    spawn: { x: 0, z: 2 },
    checkpoints: [100, 200, 300],
    targetSec: 46,
    segments: [
      { from: 0, to: 120, width: 1.6, y0: 0, y1: 0 },
      { from: 120, to: 200, width: 1.6, y0: 0, y1: 0.6 },
      { from: 200, to: 360, width: 1.6, y0: 0.6, y1: 0 },
    ],
    bananas: [
      { z: 18, x: 0 }, { z: 40, x: 0.4 }, { z: 62, x: -0.4 }, { z: 84, x: 0 },
      { z: 100, x: 0 }, { z: 132, x: 0, y: 2.6 }, { z: 150, x: 0, y: 3.4 },
      { z: 172, x: 0, y: 2.6 }, { z: 200, x: 0 }, { z: 230, x: 0, y: 3.0 },
      { z: 250, x: 0, y: 3.6 }, { z: 272, x: 0 }, { z: 300, x: 0.4 },
      { z: 322, x: -0.4 }, { z: 344, x: 0 },
    ],
    hammers: [],
    pads: [
      { z: 128, halfWidth: 1.6 },
      { z: 168, halfWidth: 1.6 },
      { z: 226, halfWidth: 1.6 },
      { z: 268, halfWidth: 1.6 },
    ],
  },
  {
    index: 5,
    name: { en: 'Grand Finish', zh: '终极冲刺' },
    length: 400,
    spawn: { x: 0, z: 2 },
    checkpoints: [120, 240, 340],
    targetSec: 50,
    segments: [
      { from: 0, to: 120, width: 1.6, y0: 0, y1: 0 },
      { from: 120, to: 180, width: 1.6, y0: 0, y1: 2.4 },   // 大坡
      { from: 180, to: 210, width: 1.6, y0: 2.4, y1: 2.4 },
      { from: 210, to: 290, width: 1.6, y0: 2.4, y1: 0.4 }, // 冲刺下坡
      { from: 290, to: 400, width: 1.6, y0: 0.4, y1: 0 },
    ],
    bananas: [
      { z: 20, x: 0 }, { z: 44, x: 0.4 }, { z: 68, x: -0.4 }, { z: 92, x: 0 },
      { z: 120, x: 0 }, { z: 150, x: 0 }, { z: 180, x: 0 }, { z: 210, x: 0.4 },
      { z: 230, x: -0.4 }, { z: 250, x: 0.4 }, { z: 270, x: -0.4 }, { z: 292, x: 0 },
      { z: 320, x: 0.4 }, { z: 344, x: -0.4 }, { z: 366, x: 0 }, { z: 388, x: 0 },
    ],
    hammers: [
      { z: 150, arm: 1.5, freq: 1.6, phase: 0 },
      { z: 240, arm: 1.5, freq: 1.7, phase: 2.2 },
    ],
    pads: [],
  },
];
