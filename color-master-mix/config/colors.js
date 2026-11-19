// COLOR MASTER MIX · 霓虹街机色板（8 色系 × 8 色块 = 64 色，全部程序化生成，零素材）
// 色相按彩虹 8 段铺开，每个色系从「暗」到「亮霓虹」8 档，sim 只存 0..63 索引，渲染查 PALETTE。
import { GAME } from './game.config.js';

const FAMILY_KEYS = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'];
const FAMILY_HUE = [0, 28, 52, 120, 176, 214, 272, 320];

function hslToHex(h, s, l) {
  const S = s / 100;
  const L = l / 100;
  const C = (1 - Math.abs(2 * L - 1)) * S;
  const H = ((h % 360) + 360) % 360 / 60;
  const X = C * (1 - Math.abs((H % 2) - 1));
  let r = 0; let g = 0; let b = 0;
  if (H < 1) [r, g, b] = [C, X, 0];
  else if (H < 2) [r, g, b] = [X, C, 0];
  else if (H < 3) [r, g, b] = [0, C, X];
  else if (H < 4) [r, g, b] = [0, X, C];
  else if (H < 5) [r, g, b] = [X, 0, C];
  else [r, g, b] = [C, 0, X];
  const m = L - C / 2;
  const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function buildPalette() {
  const families = [];
  for (let f = 0; f < GAME.FAMILIES; f += 1) {
    const shades = [];
    for (let s = 0; s < GAME.SHADES; s += 1) {
      const t = s / (GAME.SHADES - 1);
      const lightness = 24 + t * 42;   // 24 → 66
      const saturation = 92 - t * 6;   // 92 → 50（暗档略降饱和，避免脏色）
      shades.push(hslToHex(FAMILY_HUE[f], saturation, lightness));
    }
    families.push({ key: FAMILY_KEYS[f], hue: FAMILY_HUE[f], shades });
  }
  return families;
}

export const PALETTE = buildPalette();

export function colorHex(index) {
  const f = Math.floor(index / GAME.SHADES);
  const s = index % GAME.SHADES;
  const family = PALETTE[f] || PALETTE[0];
  return (family.shades[s]) || '#ffffff';
}

export function colorIndex(family, shade) {
  return family * GAME.SHADES + shade;
}

// 由 hex 反推「亮暗程度」用于锁定文字/描边对比色（0..1，越大越亮）
export function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255; const g = (n >> 8) & 255; const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
