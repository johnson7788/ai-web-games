// CAKE KART · 渲染主题：三场景包色板 + 颜色工具 + 相机/精灵常量。
// 纯数据 + 颜色小工具，不含渲染逻辑。

export const WORLD = { WIDTH: 1280, HEIGHT: 720, MAP_SIZE: 2048 };

export const DPR_CAP = 2;

export const CAMERA = {
  HEIGHT: 205,      // 相机离地高度（世界单位）
  FOCAL: 360,       // 焦距（像素）
  HORIZON: 200,     // 地平线屏幕 y
};

// 低分辨率 Mode7 地板缓冲（性能：每帧采样这些像素再放大）
export const FLOOR = { W: 320, H: 180 };

export const KART_SPRITE = {
  W: 26,   // 卡丁车世界宽（用于投影缩放）
  L: 34,   // 卡丁车世界长
};

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

export function mixRgb(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// 三场景包：翻糖平原（粉白）/ 巧克力谷（棕金）/ 冰淇淋峰（青白）
export const SCENES = [
  {
    name: 'fondant',
    skyTop: '#ffd9ea',
    skyBottom: '#fff3f8',
    ground: '#b3597f',
    groundDot: '#d98ba9',
    track: '#ffffff',
    trackEdge: '#6d2a4a',
    trackCenter: '#f2a9c5',
    jelly: '#ff2e7e',
    mud: '#7a4a2b',
    accent: '#ff5f9e',
    barrier: '#6d2a4a',
  },
  {
    name: 'chocolate',
    skyTop: '#4a2c18',
    skyBottom: '#d99a5b',
    ground: '#33200f',
    groundDot: '#5c3a1d',
    track: '#e0ab66',
    trackEdge: '#1e0f06',
    trackCenter: '#c08945',
    jelly: '#ffd166',
    mud: '#3a1f0d',
    accent: '#ffcf7a',
    barrier: '#140a03',
  },
  {
    name: 'icecream',
    skyTop: '#9fddf0',
    skyBottom: '#eefcff',
    ground: '#6fa9bd',
    groundDot: '#a8d9e8',
    track: '#ffffff',
    trackEdge: '#2f6f88',
    trackCenter: '#b8e2ef',
    jelly: '#00b8d9',
    mud: '#4a7d92',
    accent: '#39c3e8',
    barrier: '#2f6f88',
  },
];

export function scene(i) {
  const n = Math.max(1, Math.min(3, Math.round(i) || 1));
  return SCENES[n - 1];
}

// AI 车配色（甜品系，与玩家明显区分）
export const AI_COLORS = [
  '#ff6b6b', // 草莓
  '#ffd93d', // 柠檬
  '#7bd389', // 薄荷
  '#6b9bff', // 蓝莓
  '#c58cff', // 葡萄
];

export const PLAYER_COLOR = '#ff2e7e';
export const PLAYER_ACCENT = '#ffffff';
