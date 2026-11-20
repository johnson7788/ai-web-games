// src/render/theme.js — 三个场景包（换章必换：色板 + 构图 + 装饰）
// 场景 0 春夜（蓝紫）· 场景 1 夏银河（亮白）· 场景 2 极光冬（青绿）
export const SCENES = [
  {
    id: 0,
    decoration: 'moon',   // 春夜：新月 + 淡紫星云
    bg: ['#0c0824', '#1c1440', '#3a2a6e'],
    nebula: ['rgba(111,91,208,0.14)', 'rgba(183,166,255,0.10)'],
    starCore: '#e8e0ff',
    starGlow: 'rgba(183,166,255,0.9)',
    edgeIdle: 'rgba(150,140,220,0.34)',
    edgeUsed: 'rgba(183,166,255,0.92)',
    edgeTrail: '#f2edff',
    startRing: '#ffd166',
    waypoint: '#ffd166',
    meteor: '#fff2c8',
    decor: '#cdc1ff',
  },
  {
    id: 1,
    decoration: 'milkyway', // 夏银河：斜贯银河亮带
    bg: ['#05070d', '#0c1524', '#1c3050'],
    nebula: ['rgba(143,208,255,0.12)', 'rgba(242,251,255,0.08)'],
    starCore: '#ffffff',
    starGlow: 'rgba(143,208,255,0.95)',
    edgeIdle: 'rgba(160,200,235,0.30)',
    edgeUsed: 'rgba(242,251,255,0.94)',
    edgeTrail: '#ffffff',
    startRing: '#ffe9a8',
    waypoint: '#ffe9a8',
    meteor: '#fff6d8',
    decor: '#dcefff',
  },
  {
    id: 2,
    decoration: 'aurora',  // 极光冬：青绿极光飘带
    bg: ['#031c19', '#0a2e2a', '#0e4a44'],
    nebula: ['rgba(47,214,178,0.12)', 'rgba(167,255,240,0.10)'],
    starCore: '#eafffa',
    starGlow: 'rgba(167,255,240,0.92)',
    edgeIdle: 'rgba(90,210,190,0.32)',
    edgeUsed: 'rgba(167,255,240,0.92)',
    edgeTrail: '#eafffa',
    startRing: '#ffd166',
    waypoint: '#ffd166',
    meteor: '#f0ffe8',
    decor: '#a7fff0',
  },
];

export function sceneOf(id) {
  return SCENES[((id % 3) + 3) % 3];
}
