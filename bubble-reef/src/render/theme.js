// src/render/theme.js — 三场景包（浅礁 / 夜礁 / 沉船）：色板 + 构图 + 装饰，换章必换。
export const BUBBLE_COLORS = [
  { id: 1, core: '#37d6ff', light: '#c9f3ff', glow: 'rgba(55,214,255,0.6)' },
  { id: 2, core: '#ff6ec7', light: '#ffd6ef', glow: 'rgba(255,110,199,0.6)' },
  { id: 3, core: '#ffd93b', light: '#fff3c0', glow: 'rgba(255,217,59,0.6)' },
  { id: 4, core: '#5ce87a', light: '#d6ffe2', glow: 'rgba(92,232,122,0.6)' },
  { id: 5, core: '#b58cff', light: '#e7d9ff', glow: 'rgba(181,140,255,0.6)' },
];

export const ROCK_COLOR = { core: '#5a5f66', light: '#9aa0a8', glow: 'rgba(120,128,138,0.35)' };
export const GOLD_GLOW = 'rgba(255,215,90,0.85)';

export const THEMES = {
  shallow: {
    bgTop: '#0a4a5c',
    bgBottom: '#022c3a',
    water: 'rgba(8,70,90,0.5)',
    deco: ['#0e7076', '#14a6a0', '#2fd0b0'],
    ceiling: 'rgba(130,245,235,0.45)',
    deathLine: 'rgba(255,120,120,0.4)',
    cannon: '#15b8b4',
    cannonGlow: 'rgba(40,220,200,0.6)',
    ground: '#083a46',
    bubbleTint: 'rgba(120,240,255,0.06)',
  },
  night: {
    bgTop: '#060a2a',
    bgBottom: '#01030f',
    water: 'rgba(8,10,40,0.55)',
    deco: ['#1b2a6b', '#3b2a8c', '#7a3bd6'],
    ceiling: 'rgba(130,150,255,0.4)',
    deathLine: 'rgba(255,90,140,0.45)',
    cannon: '#3b5bff',
    cannonGlow: 'rgba(90,120,255,0.6)',
    ground: '#050820',
    bubbleTint: 'rgba(120,130,255,0.06)',
  },
  wreck: {
    bgTop: '#203020',
    bgBottom: '#0a140e',
    water: 'rgba(22,32,24,0.6)',
    deco: ['#3a4a2c', '#6a5a30', '#8a6a3a'],
    ceiling: 'rgba(160,190,120,0.4)',
    deathLine: 'rgba(255,140,80,0.45)',
    cannon: '#8a9a48',
    cannonGlow: 'rgba(170,200,100,0.6)',
    ground: '#0c140e',
    bubbleTint: 'rgba(150,180,120,0.05)',
  },
};

export function themeFor(pack) {
  return THEMES[pack] || THEMES.shallow;
}

export function bubbleColor(id) {
  return BUBBLE_COLORS.find((c) => c.id === id) || BUBBLE_COLORS[0];
}
