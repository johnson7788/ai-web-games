// src/render/theme.js — 三套场景包色板（换章必换：色板 + 构图 + 装饰）。
// 主板（绿黑）/ 显卡（蓝银）/ 霓虹管（粉紫）。
export const THEMES = {
  motherboard: {
    bg: '#030c07',
    board: '#071a10',
    boardEdge: '#13422b',
    trace: '#1d5c38',
    on: '#5cff9d',
    off: '#10301f',
    offEdge: '#1a4a2e',
    glow: 'rgba(92,255,157,',
    accent: '#c6ff6a',
    danger: '#ff6a5d',
    hud: '#bfffe0',
  },
  gpu: {
    bg: '#04090f',
    board: '#08101c',
    boardEdge: '#1c3350',
    trace: '#24476e',
    on: '#5cc8ff',
    off: '#122234',
    offEdge: '#1d3a58',
    glow: 'rgba(92,200,255,',
    accent: '#a8d1ff',
    danger: '#ff6a5d',
    hud: '#d7ecff',
  },
  neon: {
    bg: '#12050f',
    board: '#1f0818',
    boardEdge: '#4a1b45',
    trace: '#5c2058',
    on: '#ff6bd6',
    off: '#3a1630',
    offEdge: '#552046',
    glow: 'rgba(255,107,214,',
    accent: '#ffb1ec',
    danger: '#ff6a5d',
    hud: '#ffe1f6',
  },
};

export function themeFor(chapter) {
  return THEMES[chapter] || THEMES.motherboard;
}
