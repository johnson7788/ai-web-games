// SAUCER STRIKE · 渲染主题：3 场景章色板 + 颜色小工具（纯数据，不含渲染逻辑）

export const WORLD = { WIDTH: 1280, HEIGHT: 720, CANNON_X: 640, CANNON_Y: 660 };
export const DPR_CAP = 2;
export const CHAPTER_FADE_SEC = 1.2;

export const FONT = '"SF Mono","Menlo","Consolas","Courier New",monospace';

export const GUN_R = 26;          // 炮塔半径
export const PROJ_R = 5;

export const PARTICLE = { cap: 260 };

export const SHAKE = { decay: 3.4, boss: 12, signature: 16 };

// 3 场景章：荒漠雷达站（沙黄）/ 极光基地（青绿）/ 城市天际线（蓝紫）
export const CHAPTERS = [
  { decor: 'desert', top: '#140a04', mid: '#4a2a12', bottom: '#8a5a2b', glow: '#ffd166', accent: '#ffb45f' },
  { decor: 'aurora', top: '#021018', mid: '#06303a', bottom: '#0a5a4a', glow: '#7df9ff', accent: '#8ff4ff' },
  { decor: 'city',   top: '#050816', mid: '#141a3a', bottom: '#2a2a5e', glow: '#c792ff', accent: '#b18cff' },
];

export function chapter(i) {
  const n = Math.round(i) || 1;
  return CHAPTERS[Math.min(CHAPTERS.length - 1, Math.max(0, n - 1))];
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
