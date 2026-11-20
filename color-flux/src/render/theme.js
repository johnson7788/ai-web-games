// COLOR FLUX · 渲染主题：3 场景包（极夜/日辉/霓虹雨）色板 + 颜色小工具
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const DPR_CAP = 2;
export const SCENE_FADE_SEC = 1.2;

export const FONT = '"SF Mono","Menlo","Consolas","Courier New",monospace';

// 场景包：0=极夜(蓝紫) 1=日辉(金橙) 2=霓虹雨(青粉)
export const SCENES = [
  {
    name: 'polar',
    top: '#070a24', mid: '#150a38', bottom: '#05030f',
    glow: '#7f6bff', accent: '#4db8ff', decor: 'aurora',
    bg2: '#0a1030',
  },
  {
    name: 'day',
    top: '#2a1205', mid: '#6b2a06', bottom: '#1a0a02',
    glow: '#ffb45f', accent: '#ffd93d', decor: 'sun',
    bg2: '#3a1808',
  },
  {
    name: 'neon',
    top: '#041018', mid: '#0a2030', bottom: '#02060a',
    glow: '#38f0d0', accent: '#ff5fa8', decor: 'rain',
    bg2: '#071820',
  },
];

export function scene(i) {
  const n = Math.round(i) || 0;
  return SCENES[Math.min(SCENES.length - 1, Math.max(0, n))];
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
  return `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function blendScene(si, so, t) {
  const a = scene(si);
  const b = scene(so);
  const s = clamp(t, 0, 1);
  const s2 = s * s * (3 - 2 * s);
  return {
    top: mixHex(a.top, b.top, s2),
    mid: mixHex(a.mid, b.mid, s2),
    bottom: mixHex(a.bottom, b.bottom, s2),
    glow: mixHex(a.glow, b.glow, s2),
    accent: mixHex(a.accent, b.accent, s2),
    decor: s < 0.5 ? a.decor : b.decor,
  };
}
