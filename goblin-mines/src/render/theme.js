// src/render/theme.js — 三套场景色板（换章必换色板+构图+装饰）。
// chapter 0 萤石洞（紫）/ 1 铜镇（橙）/ 2 深渊竖井（蓝黑）
export const CHAPTERS = [
  {
    id: 'fluorite',
    bg: ['#0d0720', '#1c0f38', '#0a0516'],
    accent: '#c47bff',
    accent2: '#7a3fd6',
    wall: '#3a2a55',
    rock: '#4a3a66',
    rockEdge: '#8a72b8',
  },
  {
    id: 'copper',
    bg: ['#1a0c05', '#3a1c0a', '#120702'],
    accent: '#ff9a3d',
    accent2: '#d95f1a',
    wall: '#4a3322',
    rock: '#5a3d26',
    rockEdge: '#c08a55',
  },
  {
    id: 'abyss',
    bg: ['#020610', '#061424', '#01040c'],
    accent: '#4d9bff',
    accent2: '#1d4fd6',
    wall: '#152433',
    rock: '#1d2f42',
    rockEdge: '#4d7ba8',
  },
];

// 矿石颜色（跨章一致，保证一眼认出）
export const ORE_COLORS = ['#ff4d6d', '#4da6ff', '#b06bff', '#4dff88', '#ffb84d', '#ffd24d'];

export function chapterOf(chapter) {
  return CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, chapter))];
}
