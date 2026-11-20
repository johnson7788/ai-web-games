// src/render/theme.js — 三场景包（换章必换：色板 + 构图 + 装饰）
// 近轨（蓝白）/ 小行星（灰橙）/ 深空（紫黑）
export const THEMES = {
  orbit: {
    key: 'orbit',
    bgTop: '#051019',
    bgBottom: '#0d2a40',
    grid: 'rgba(127, 242, 255, 0.16)',
    star: '#bfefff',
    decor: ['#4fc3f7', '#81d4fa', '#e1f5fe'],
    glow: 'rgba(127, 242, 255, 0.5)',
  },
  asteroid: {
    key: 'asteroid',
    bgTop: '#160f08',
    bgBottom: '#3a2410',
    grid: 'rgba(255, 159, 67, 0.14)',
    star: '#ffd9a0',
    decor: ['#8a5a3a', '#b0794a', '#e0a060'],
    glow: 'rgba(255, 159, 67, 0.5)',
  },
  deep: {
    key: 'deep',
    bgTop: '#08030f',
    bgBottom: '#1c0b33',
    grid: 'rgba(195, 155, 255, 0.14)',
    star: '#d9c6ff',
    decor: ['#6a3fd6', '#8f5ff0', '#b78cff'],
    glow: 'rgba(195, 155, 255, 0.5)',
  },
};

export function themeFor(key) {
  return THEMES[key] || THEMES.orbit;
}
