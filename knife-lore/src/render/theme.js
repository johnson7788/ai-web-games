// KNIFE LORE · 渲染主题：三大场景包色板 + 绘制常量。
// 纯数据 + 颜色小工具，不含渲染逻辑。

export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const DPR_CAP = 2;

export const FONT = '"SF Mono","Menlo","Consolas","Courier New",monospace';

export const POST = {
  ringWidth: 18,
  woodOuter: '#5d3a22',
  woodInner: '#8a5a33',
  paper: '#f1e4c4',
  ink: '#140f0a',
  cap: '#3a2413',
};

export const KNIFE = {
  bladeLen: 30,
  bladeW: 9,
  bladeColor: '#e8eef4',
  edgeColor: '#b9c8d6',
  glow: 'rgba(232, 238, 244, 0.85)',
};

export const PARTICLE = {
  cap: 260,
  inkMax: 40,
};

// 三大场景包色板（换章必换：色板+构图+装饰）
export const PACKS = {
  bamboo: {
    name: 'bamboo',
    top: '#0b3d2c', mid: '#093020', bottom: '#04180f',
    glow: '#7ef0b0', accent: '#c7f0c0', ink: '#08140c',
    postTint: 'rgba(200, 240, 190, 0.10)',
    decor: 'bamboo',
  },
  dusk: {
    name: 'dusk',
    top: '#3a0f12', mid: '#290a0d', bottom: '#150507',
    glow: '#ff8a5c', accent: '#ffb45f', ink: '#1a0607',
    postTint: 'rgba(255, 138, 92, 0.12)',
    decor: 'city',
  },
  snow: {
    name: 'snow',
    top: '#17344c', mid: '#0f2336', bottom: '#06121c',
    glow: '#9fd7ff', accent: '#e8f5ff', ink: '#06121c',
    postTint: 'rgba(159, 215, 255, 0.12)',
    decor: 'peak',
  },
};

export function packOf(name) {
  return PACKS[name] || PACKS.bamboo;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbCss(c, alpha = 1) {
  const r = Math.round(c[0]);
  const g = Math.round(c[1]);
  const b = Math.round(c[2]);
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}
