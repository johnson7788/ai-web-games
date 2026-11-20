// src/render/theme.js — 渲染主题：三场景色板 / 尺寸 / 颜色小工具。
// 纯数据 + 颜色函数，不含渲染逻辑。
export const WORLD = { WIDTH: 1280, HEIGHT: 720, GROUND_Y: 640 };
export const DPR_CAP = 2;
export const SCENE_FADE_SEC = 1.2;

export const FONT = '"SF Mono","Menlo","Consolas","Courier New",monospace';

export const PLAYER = {
  bodyR: 15, // 身体半径（头部）
  torsoW: 30,
  torsoH: 40,
  umbrellaR: 74, // 撑开的伞半径
  umbrellaClosed: 18, // 收伞时可见的伞柄/布
};

export const PARTICLE = {
  cap: 320,
  burstN: 12,
};

// 三场景色板：晴午天台（亮蓝）/ 雷雨（灰紫电光）/ 晚霞（金橙）
export const SCENES = [
  {
    name: 'noon',
    top: '#7ec8f5', mid: '#b7e3fb', bottom: '#e7f4fc',
    skyAccent: '#ffffff', ground: '#8a6a4f', groundTop: '#b3906a',
    glow: '#ffe27a', accent: '#2aa9c4', item: '#2a3540', fog: '#dff2fc',
    window: '#5aa8d8',
  },
  {
    name: 'thunder',
    top: '#2a2640', mid: '#4a4560', bottom: '#8a84a0',
    skyAccent: '#c9c3ff', ground: '#3a3550', groundTop: '#5a5474',
    glow: '#f4d9ff', accent: '#8f7dff', item: '#1c1830', fog: '#3a3650',
    window: '#6f6a9a',
  },
  {
    name: 'dusk',
    top: '#ffb35c', mid: '#ff8a5c', bottom: '#ffd9a0',
    skyAccent: '#fff2d0', ground: '#6a4a3a', groundTop: '#a06a4a',
    glow: '#ffd166', accent: '#ff7a3c', item: '#3a2620', fog: '#ffe0b0',
    window: '#ff9a5c',
  },
];

export function scene(i) {
  const n = Math.round(i) || 1;
  return SCENES[Math.min(SCENES.length - 1, Math.max(0, n - 1))];
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixRgb(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
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

// 物体颜色（按 kind）
export const ITEM_COLORS = {
  bottle: '#4dd7ff',
  pot: '#c96a3b',
  cup: '#ffd166',
  can: '#8be28b',
  drone: '#ff6b81',
  fridge: '#cfd8e3',
  sofa: '#c98bd8',
  tv: '#8fb6ff',
};
