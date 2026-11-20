// src/render/theme.js — 三套场景色板（书桌暖木 / 玩具城彩 / 夜库靛蓝）。
// 换章必换：地板色 + 障碍色 + 装饰 + 氛围光。
export const THEMES = [
  {
    id: 'desk',
    floor: '#3d2b1f',
    floorAlt: '#4a3526',
    grid: 'rgba(255, 210, 150, 0.05)',
    obstacle: '#8a5a34',
    obstacleEdge: '#5d3a1e',
    vignette: 'rgba(40, 22, 10, 0.55)',
    accent: '#ffc94a',
    danger: 'rgba(255, 90, 60, 0.30)',
    label: '#e8d3a8',
  },
  {
    id: 'toy',
    floor: '#2b4a6f',
    floorAlt: '#33587f',
    grid: 'rgba(255, 255, 255, 0.06)',
    obstacle: '#e8574a',
    obstacleEdge: '#a32f26',
    vignette: 'rgba(15, 25, 40, 0.5)',
    accent: '#7ef0ff',
    danger: 'rgba(255, 70, 120, 0.28)',
    label: '#cfe9ff',
  },
  {
    id: 'night',
    floor: '#141a2e',
    floorAlt: '#1b2440',
    grid: 'rgba(120, 150, 255, 0.05)',
    obstacle: '#2f3a5c',
    obstacleEdge: '#0f1526',
    vignette: 'rgba(4, 6, 14, 0.6)',
    accent: '#c9b6ff',
    danger: 'rgba(200, 60, 90, 0.30)',
    label: '#9fb0e8',
  },
];

export function themeFor(match) {
  // 书桌(1-4) / 玩具城(5-8) / 夜库(9-12)
  const idx = Math.floor((match - 1) / 4);
  return THEMES[Math.min(Math.max(idx, 0), THEMES.length - 1)];
}
