// src/render/theme.js — 三场景包色板（黄土暖褐 / 化石暗河青黑 / 熔核红金）
export const THEME_PALETTES = [
  { // 0 黄土层
    id: 'loam',
    bgTop: '#4a3318', bgBottom: '#1a1005',
    shaftWall: '#7a5c30', shaftDark: '#2a1c08',
    dirt: ['#d29a52', '#b67a2e'],
    rock: '#5c4634',
    diamond: '#8fe4ff', fossil: '#e8cf9a', fault: '#6a2a16',
    flood: '#2a7a9a', floodGlow: '#6ac8e8',
    rig: '#f0c060', rigDark: '#8a5a20', accent: '#ffcf6a',
    strata: ['#3a2a12', '#573a18'],
  },
  { // 1 化石暗河
    id: 'fossil',
    bgTop: '#07242e', bgBottom: '#010a0e',
    shaftWall: '#16424e', shaftDark: '#04161c',
    dirt: ['#1f4a56', '#163a44'],
    rock: '#26383e',
    diamond: '#8fefff', fossil: '#9adcc8', fault: '#14303e',
    flood: '#0f8ba6', floodGlow: '#5ad4f0',
    rig: '#4ad8d8', rigDark: '#0e5a5e', accent: '#7ff0e8',
    strata: ['#07262f', '#0a3038'],
  },
  { // 2 熔核
    id: 'core',
    bgTop: '#43130a', bgBottom: '#150403',
    shaftWall: '#6e2a16', shaftDark: '#260a04',
    dirt: ['#d06a30', '#b24a1c'],
    rock: '#4a1a10',
    diamond: '#ffd86a', fossil: '#ff9a66', fault: '#7a120a',
    flood: '#ff6a1e', floodGlow: '#ffb060',
    rig: '#ffcf6a', rigDark: '#8a3a10', accent: '#ffb020',
    strata: ['#3a1208', '#571808'],
  },
];

export function themeFor(themeIndex) {
  return THEME_PALETTES[Math.max(0, Math.min(2, themeIndex))];
}
