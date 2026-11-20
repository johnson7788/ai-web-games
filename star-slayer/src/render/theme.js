// STAR SLAYER · 渲染主题：三场景色板 + 粒子参数 + 颜色工具
// 纯数据，不含渲染逻辑。场景：0 舰桥（蓝白）/ 1 舰体外壳（灰橙）/ 2 反应堆（青紫）。

export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const ARENA_TOP = 96; // 与 config/game.config.js 一致：顶部 HUD 保留区
export const DPR_CAP = 2;
export const SCENE_FADE_SEC = 1.2;

export const FONT = '"SF Mono","Menlo","Consolas","Courier New",monospace';

export const GLOW = {
  player: 26,
  core: 20,
  bullet: 9,
  enemyBullet: 9,
};

export const PARTICLE = {
  cap: 320,
  life: 0.7,
};

export const SHAKE = { decay: 3.2, boss: 12, overload: 16 };

// 三场景色板：top/mid/bottom 是背景渐变，grid 是地格线，glow 是氛围光
export const SCENES = [
  {
    name: 'bridge',
    top: '#0b2340', mid: '#0a1a30', bottom: '#050d1c',
    grid: 'rgba(120,200,255,0.10)',
    glow: '#54e7ff',
    decor: 'pilot',   // 舰桥仪表点
    accent: '#8ff4ff',
  },
  {
    name: 'hull',
    top: '#1e1710', mid: '#161009', bottom: '#0a0603',
    grid: 'rgba(255,170,90,0.10)',
    glow: '#ff9e4f',
    decor: 'panel',   // 装甲板
    accent: '#ffb45f',
  },
  {
    name: 'reactor',
    top: '#0e0630', mid: '#0a0524', bottom: '#04020f',
    grid: 'rgba(150,110,255,0.12)',
    glow: '#8f6bff',
    decor: 'core',    // 反应堆脉冲
    accent: '#b18cff',
  },
];

export function scenePalette(i) {
  const n = Math.round(i) || 0;
  return SCENES[Math.min(SCENES.length - 1, Math.max(0, n))];
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
