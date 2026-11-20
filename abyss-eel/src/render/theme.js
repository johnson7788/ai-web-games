// ABYSS EEL · 渲染主题：所有颜色 / 半径 / 粒子参数集中在此。
// 纯数据 + 颜色小工具，不含渲染逻辑。

export const WORLD = { WIDTH: 1280, HEIGHT: 720, HEAD_Y: 540 };
export const DPR_CAP = 2;
export const ZONE_FADE_SEC = 1.5;

export const FONT = '"SF Mono","Menlo","Consolas","Courier New",monospace';

export const EEL = {
  headRadius: 15,
  headGlow: 30,
  bodyWidth: 8,
  bodyGlowWidth: 22,
  orbRadius: 7,
  orbGlow: 17,
  finFlapSpeed: 8,
  dashBeamLen: 340,
};

export const WALL = {
  minH: 26,
  textMin: 22,
  outlineWidth: 4,
  radius: 7,
  halo: 9,
  bossSegs: 5,
};

export const URCHIN = { r: 17, spikes: 16, spikeLen: 10 };

export const BOSS = { crackN: 5 };

export const FOOD = { r: 8, glow: 16 };

export const PARTICLE = {
  cap: 300,
  bubbleMax: 26,
  bubbleRise: 24, // px/s
};

export const LIGHT = {
  minRadius: 160,
  perOrb: 14,
  maxRadius: 900,
  darkAlpha: 0.86,
  centerGlow: 0.12,
};

export const SHAKE = { decay: 3.4, boss: 13 };

// 5 深度带色板：阳光带 → 午夜带 → 热泉带（暗红）。
export const ZONES = [
  { name: 'sunlit',       top: '#0b6e8a', mid: '#0a4c60', bottom: '#04303f', glow: '#7df9ff', wallLow: '#2fe6c8', wallHigh: '#ffd166', accent: '#8ff4ff', decor: 'jelly'   },
  { name: 'twilight',     top: '#0a2f52', mid: '#061d36', bottom: '#020d1c', glow: '#6fd8ff', wallLow: '#35e0c8', wallHigh: '#ff9e4f', accent: '#7dd8ff', decor: 'lantern' },
  { name: 'midnight',     top: '#010714', mid: '#010a18', bottom: '#00050c', glow: '#7df9ff', wallLow: '#4dd7ff', wallHigh: '#ff5f7e', accent: '#7df9ff', decor: 'lantern' },
  { name: 'abyss',        top: '#02070f', mid: '#03050c', bottom: '#010207', glow: '#7df9ff', wallLow: '#5eead4', wallHigh: '#ff3d5a', accent: '#7df9ff', decor: 'jelly'   },
  { name: 'hydrothermal', top: '#1a0602', mid: '#120302', bottom: '#0a0101', glow: '#ffd166', wallLow: '#ff9e4f', wallHigh: '#ff3d2e', accent: '#ffb45f', decor: 'vent'    },
];

export function zone(i) {
  const n = Math.round(i) || 1;
  return ZONES[Math.min(ZONES.length - 1, Math.max(0, n - 1))];
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
