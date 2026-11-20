// NEO TETRA · 渲染主题：棋盘布局 / 3 场景包 / 矿石色 / 粒子参数（纯数据 + 颜色小工具）。

export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const DPR_CAP = 2;
export const FONT = '"SF Mono","Menlo","Consolas","Courier New",monospace';

// 棋盘布局（逻辑世界 1280×720）
export const BOARD = {
  X: 500,      // 井左上角 x
  Y: 84,       // 井左上角 y
  CELL: 28,    // 单格像素
  COLS: 10,
  ROWS: 20,
};

// 侧板预览面板
export const PANEL = {
  HOLD_X: 132,
  HOLD_Y: 130,
  NEXT_X: 856,
  NEXT_Y: 130,
  CELL: 20,
};

// 粒子
export const PARTICLE = {
  cap: 420,
  clearCount: 26,
  tetraCount: 90,
};

// 3 场景包：换章必换色板 + 构图 + 装饰。
export const SCENE_PACKS = {
  copper: { top: '#2a1204', mid: '#180a02', bottom: '#0a0300', glow: '#ffb45f', frame: '#7a4a20', accent: '#ffd166', decor: 'crystal' },
  ice:    { top: '#03202e', mid: '#02121c', bottom: '#01070c', glow: '#7df9ff', frame: '#2a7a8a', accent: '#a7f6ff', decor: 'crystal' },
  core:   { top: '#200200', mid: '#140100', bottom: '#0a0000', glow: '#ff5d3a', frame: '#8a2a16', accent: '#ff8a5c', decor: 'vent' },
};

// 经典 7 色轮（type → hue），每层按 baseHue 整体偏转得到「换一种矿石」的色板。
const CLASSIC_HUES = { I: 180, O: 45, T: 290, S: 120, Z: 0, J: 220, L: 30 };
const COLOR_TO_TYPE = { 1: 'I', 2: 'O', 3: 'T', 4: 'S', 5: 'Z', 6: 'J', 7: 'L' };

export function hslCss(h, s, l, a = 1) {
  return a >= 1 ? `hsl(${h} ${s}% ${l}%)` : `hsl(${h} ${s}% ${l}% / ${a})`;
}

// 某层某块（colorId 1..7）的矿石色。
export function oreColor(baseHue, colorId) {
  const type = COLOR_TO_TYPE[colorId] || 'I';
  const hue = ((CLASSIC_HUES[type] + (baseHue - 30)) % 360 + 360) % 360;
  return { hue, css: hslCss(hue, 82, 56), glow: hslCss(hue, 90, 66) };
}

// 石头 / 墙 / ghost 的颜色。
export const SPECIAL = {
  stone: '#4a4f57',
  stoneEdge: '#2b2e33',
  wall: '#1a1206',
  ghost: 'rgba(255,255,255,0.22)',
  ghostEdge: 'rgba(255,255,255,0.4)',
  darkAlpha: 0.16, // 暗井：堆叠仅 16% 亮度
};

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixRgb(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function rgbCss(c, alpha = 1) {
  const r = Math.round(c[0]);
  const g = Math.round(c[1]);
  const b = Math.round(c[2]);
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

export function mixHex(a, b, t) {
  const c = mixRgb(hexToRgb(a), hexToRgb(b), t);
  const r = Math.round(c[0]).toString(16).padStart(2, '0');
  const g = Math.round(c[1]).toString(16).padStart(2, '0');
  const bl = Math.round(c[2]).toString(16).padStart(2, '0');
  return `#${r}${g}${bl}`;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
