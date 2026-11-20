// src/render/theme.js — IRON SIEGE 渲染主题：三场景色板 + 画布布局（纯常量）。
import { MAP } from '../../config/gameplay.js';

export const SCALE = 3;                    // 世界单位 → 画布像素
export const ORIGIN = { x: 32, y: 48 };     // 战场左上角（世界 y=208 处）
export const DPR_CAP = 2;

export const BATTLE = {
  w: MAP.W * SCALE,   // 624
  h: MAP.H * SCALE,
};

export function worldToScreen(x, y) {
  return { x: ORIGIN.x + x * SCALE, y: ORIGIN.y + (MAP.H - y) * SCALE };
}

// 三场景色板：旷野（土黄）/ 雪原（蓝白）/ 熔城（暗红）——换章必换。
export const PALETTES = {
  wastes: {
    bg: '#241d10', ground: '#33291a', grid: 'rgba(120,90,40,0.16)',
    brick: '#a9743f', brickLine: '#5c3a1e', brickRivet: '#7a4c26',
    steel: '#7a8690', steelLine: '#3f464c', steelRivet: '#98a6b0',
    water: '#3a6ea5', waterFoam: '#6fa0c8',
    grass: '#5a8a3a', grassDark: '#3a5c24',
    player: '#6fe8ff', playerDark: '#1a5a68', enemy: '#b04a3a', accent: '#e8a04a',
  },
  snowfield: {
    bg: '#0c1a26', ground: '#cfe0ee', grid: 'rgba(140,170,200,0.16)',
    brick: '#9fb6c8', brickLine: '#5a7488', brickRivet: '#6f8aa0',
    steel: '#8a9aa8', steelLine: '#4a5a68', steelRivet: '#a8bcc8',
    water: '#6fb0d8', waterFoam: '#a8d8f0',
    grass: '#b8dcc8', grassDark: '#7aa890',
    player: '#7fd4ff', playerDark: '#1a4a66', enemy: '#c04a3a', accent: '#7fd4ff',
  },
  molten: {
    bg: '#180c0a', ground: '#2a1410', grid: 'rgba(200,90,40,0.16)',
    brick: '#8a4030', brickLine: '#40160c', brickRivet: '#5c2818',
    steel: '#55555e', steelLine: '#2c2c34', steelRivet: '#70707c',
    water: '#e06020', waterFoam: '#ff9a40',
    grass: '#6a3a20', grassDark: '#3a1c10',
    player: '#ffd27f', playerDark: '#6a4a1a', enemy: '#c84a2a', accent: '#ff6a2a',
  },
};

export const PALETTE_KEYS = ['wastes', 'snowfield', 'molten'];

export function paletteFor(scene) {
  return PALETTES[PALETTE_KEYS[(scene - 1) % PALETTE_KEYS.length]] || PALETTES.wastes;
}
