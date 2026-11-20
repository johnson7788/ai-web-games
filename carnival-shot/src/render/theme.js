// CARNIVAL SHOT · 渲染主题：三场景包色板 + 字体 + 粒子参数。
// 纯数据 + 颜色小工具，不含渲染逻辑。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const DPR_CAP = 2;
export const FONT = '"PingFang SC","Hiragino Sans","Segoe UI","Microsoft YaHei","Courier New",monospace';

// 三场景包：灯会（暖红）/ 河灯（青蓝）/ 烟花夜（金紫）。换章必换：色板+构图+装饰。
export const SCENES = {
  lantern: {
    key: 'lantern',
    skyTop: '#2b0a1c',
    skyMid: '#5c1330',
    skyBottom: '#18060f',
    glow: '#ffb347',
    accent: '#ff7a6b',
    accent2: '#ffd166',
    booth: '#2a0a14',
    boothLit: '#7a1f35',
    water: '#3a1020',
    decor: 'lanterns',
  },
  river: {
    key: 'river',
    skyTop: '#04192b',
    skyMid: '#063d50',
    skyBottom: '#02101d',
    glow: '#6fd8ff',
    accent: '#3fd0c9',
    accent2: '#9be8ff',
    booth: '#03202c',
    boothLit: '#0b4a5a',
    water: '#062a38',
    decor: 'lotus',
  },
  fireworks: {
    key: 'fireworks',
    skyTop: '#1b0b36',
    skyMid: '#38155f',
    skyBottom: '#120722',
    glow: '#ffd166',
    accent: '#c77dff',
    accent2: '#ff9ef5',
    booth: '#160822',
    boothLit: '#3c1a5e',
    water: '#1d0b30',
    decor: 'bursts',
  },
};

export const PARTICLE = {
  cap: 420,
  hit: 14,
  muzzle: 6,
  rain: 90,
  rainLife: 2.6,
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
  return v < lo ? lo : (v > hi ? hi : v);
}

export function scene(name) {
  return SCENES[name] || SCENES.lantern;
}
