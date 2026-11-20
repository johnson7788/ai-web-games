// src/render/theme.js — 三套场景色板（换章必换：色板 + 构图 + 装饰）。
// 场景 1 殖民巷（紫灰）· 2 反应场（青绿）· 3 夜空港（深蓝）。
export const THEMES = [
  {
    // 1 · 殖民巷：紫灰 + 霓虹紫
    ceiling: '#150e1c',
    floor: '#221427',
    wallTop: [122, 98, 148],   // 紫灰
    wallSide: [74, 58, 92],
    fog: [36, 20, 50],
    accent: '#b47aff',
    decor: 'neon',
  },
  {
    // 2 · 反应场：青绿 + 荧光青
    ceiling: '#0a1a1a',
    floor: '#0f241f',
    wallTop: [56, 176, 156],   // 青绿
    wallSide: [34, 112, 100],
    fog: [6, 34, 30],
    accent: '#54ffd8',
    decor: 'grid',
  },
  {
    // 3 · 夜空港：深蓝 + 星光
    ceiling: '#050a18',
    floor: '#0a1226',
    wallTop: [52, 88, 148],    // 深蓝
    wallSide: [30, 52, 92],
    fog: [8, 14, 34],
    accent: '#6db2ff',
    decor: 'stars',
  },
];
