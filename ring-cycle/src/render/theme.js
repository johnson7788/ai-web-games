// src/render/theme.js — RING CYCLE · 颜色与 3 场景包（果味车间 / 薄荷库 / 夜光仓）
// 换章必换：背景色板 + 装饰元素 + 环金属色。糖球染色 4 色跨章固定（颜色即生命线）。

export const DYE_COLORS = [
  { name: 'strawberry', hex: '#ff5d8f', deep: '#c22a5f' },
  { name: 'lemon', hex: '#ffd23f', deep: '#c9931a' },
  { name: 'mint', hex: '#3ddc97', deep: '#1a9a68' },
  { name: 'blueberry', hex: '#5b8cff', deep: '#2f5fd0' },
];

export const WHITE_HEX = '#f4f7ff';
export const WHITE_DEEP = '#c9d4e8';
export const WOOD_HEX = '#c98a5b';
export const WOOD_DEEP = '#8a5733';

export const SCENES = {
  fruity: {
    top: '#2a0f1c',
    mid: '#4a1a2c',
    bottom: '#7a2f3a',
    accent: '#ff9db8',
    rail: '#5a2234',
    decor: ['#ff5d8f', '#ffd23f', '#ff9db8', '#fff3f6'],
    ring: '#b8586e',
    glow: 'rgba(255,93,143,0.55)',
  },
  mint: {
    top: '#07251f',
    mid: '#0b3a2e',
    bottom: '#11513f',
    accent: '#7df0cf',
    rail: '#0e4636',
    decor: ['#3ddc97', '#b7f7e3', '#2fb6a2', '#eafffb'],
    ring: '#3f9c86',
    glow: 'rgba(61,220,151,0.55)',
  },
  glow: {
    top: '#0a0b2a',
    mid: '#161a4a',
    bottom: '#2a2366',
    accent: '#9a9dff',
    rail: '#1c1f52',
    decor: ['#5b8cff', '#b28bff', '#7ee8ff', '#efeaff'],
    ring: '#5d5fa8',
    glow: 'rgba(91,140,255,0.55)',
  },
};

export function sceneById(id) {
  return SCENES[id] || SCENES.fruity;
}

export function dyeHex(dye) {
  return (DYE_COLORS[dye] || DYE_COLORS[0]).hex;
}

export function dyeDeep(dye) {
  return (DYE_COLORS[dye] || DYE_COLORS[0]).deep;
}

export function cellHex(color) {
  if (color === -1) return WHITE_HEX;
  if (color === -2) return WOOD_HEX;
  return dyeHex(color);
}
