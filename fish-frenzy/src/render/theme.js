// FISH FRENZY · 渲染主题：所有颜色 / 半径 / 粒子参数集中在此。
// 三场景包：珊瑚渔场(亮青) / 深沟(深蓝) / 热泉(暗红)。
export const WORLD = { WIDTH: 1280, HEIGHT: 720, CANNON_X: 640, CANNON_Y: 690 };
export const DPR_CAP = 2;
export const FONT = '"SF Mono","Menlo","Consolas","Courier New",monospace';

export const SCENES = [
  { name: 'coral',  top: '#0b7d9a', mid: '#06485e', bottom: '#02212f', glow: '#5ef2ff', decor: 'coral',  accent: '#ffd166' },
  { name: 'trench', top: '#082a54', mid: '#041733', bottom: '#010a18', glow: '#6fd8ff', decor: 'rock',   accent: '#8ff4ff' },
  { name: 'vent',   top: '#3a0a02', mid: '#1c0502', bottom: '#0b0101', glow: '#ffb45f', decor: 'vent',   accent: '#ff5d3e' },
];

export function scenePalette(sceneIdx) {
  const n = Math.max(1, Math.min(3, Math.round(sceneIdx) || 1));
  return SCENES[n - 1];
}

// 鱼种发光色（发光深海种）
export const FISH_COLORS = [
  null,
  { body: '#ffd166', glow: 'rgba(255,209,102,0.85)' },  // 1 lantern
  { body: '#9fd8ff', glow: 'rgba(159,216,255,0.85)' },  // 2 sardine
  { body: '#ff9e4f', glow: 'rgba(255,158,79,0.85)' },   // 3 butterfly
  { body: '#5eead4', glow: 'rgba(94,234,212,0.85)' },   // 4 grouper
  { body: '#ff5d73', glow: 'rgba(255,93,115,0.85)' },   // 5 lionfish
  { body: '#7dffb0', glow: 'rgba(125,255,176,0.85)' },  // 6 turtle
  { body: '#c792ff', glow: 'rgba(199,146,255,0.85)' },  // 7 manta
  { body: '#7dd8ff', glow: 'rgba(125,216,255,0.85)' },  // 8 hammerhead
  { body: '#f4ead8', glow: 'rgba(244,234,216,0.9)' },   // 9 oarfish
  { body: '#ff3d3d', glow: 'rgba(255,61,61,0.9)' },     // 10 megamouth
];

export const CANNON_COL = { base: '#2a3a4a', barrel: '#54e7ff', glow: 'rgba(84,231,255,0.8)', tip: '#eaffff' };
export const TIER_COLORS = ['#54e7ff', '#5eead4', '#ffd166', '#ff9e4f', '#ff5d73', '#c792ff', '#ff3d3d'];

export const PARTICLE = {
  cap: 380,
  bubbleMax: 30,
  bubbleRise: 26, // px/s
};

export const NET_RING = { color: 'rgba(84,231,255,0.9)', width: 3 };

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

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
