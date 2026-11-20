// src/render/theme.js — 3 场景色板（换章必换：色板 + 构图装饰）。
// 酒馆（暖木）· 山寨（青绿）· 夜市（红灯）。
export const THEMES = {
  tavern: {
    bgTop: '#241209',
    bgBottom: '#4a2a14',
    glow: '#ffb54a',
    accent: '#e8a33d',
    accent2: '#c96f2b',
    frame: '#3a2413',
    frameLight: '#8a5a2e',
    frameEdge: '#d9a24a',
    cell: '#f4e7cf',
    cellBorder: '#c39a62',
    cellText: '#5a3a1e',
    reelShadow: 'rgba(0,0,0,0.45)',
    lantern: '#ffcf6a',
    decor: 'lantern',
  },
  stronghold: {
    bgTop: '#0c1f14',
    bgBottom: '#173524',
    glow: '#8fe0b0',
    accent: '#7fd4a0',
    accent2: '#3d8b6f',
    frame: '#173323',
    frameLight: '#2f5a40',
    frameEdge: '#8fd6a8',
    cell: '#e9f1e4',
    cellBorder: '#7fa88a',
    cellText: '#27422f',
    reelShadow: 'rgba(0,0,0,0.45)',
    lantern: '#7fe0b0',
    decor: 'banner',
  },
  nightmarket: {
    bgTop: '#16091f',
    bgBottom: '#2e1127',
    glow: '#ff5d73',
    accent: '#ff5d73',
    accent2: '#ff8a4a',
    frame: '#2c1225',
    frameLight: '#4a1c38',
    frameEdge: '#ff7a8a',
    cell: '#f6e4d8',
    cellBorder: '#c07a6a',
    cellText: '#4a2a22',
    reelShadow: 'rgba(0,0,0,0.45)',
    lantern: '#ff5d73',
    decor: 'lantern',
  },
};

export function themeFor(scene) {
  return THEMES[scene] || THEMES.tavern;
}
