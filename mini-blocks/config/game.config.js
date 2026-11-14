// 全局数值配置 —— Mini Blocks（第一人称 3D 体素沙盒）
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

// 体素世界尺寸（y 向上）
export const SX = 32, SY = 24, SZ = 32;

export const GRAVITY = 24;

// 方块：id → 名称 / 顶面 / 侧面 / 底面颜色 / 硬度
export const BLOCKS = {
  0: { name: 'air', top: null, side: null, bottom: null, hard: 0 },
  1: { name: 'grass', top: '#6cc86a', side: '#8a6b4a', bottom: '#7a5a3a', hard: 0.4 },
  2: { name: 'dirt', top: '#8a5a34', side: '#8a5a34', bottom: '#8a5a34', hard: 0.4 },
  3: { name: 'stone', top: '#9aa2b1', side: '#8b93a3', bottom: '#7d8595', hard: 0.9 },
  4: { name: 'wood', top: '#b8905a', side: '#9a6b3f', bottom: '#b8905a', hard: 0.6 },
  5: { name: 'leaves', top: '#4f9a58', side: '#3f8a48', bottom: '#357a3e', hard: 0.2 },
  6: { name: 'sand', top: '#e0ca82', side: '#d9c27a', bottom: '#cdb66e', hard: 0.3 },
  7: { name: 'brick', top: '#c8645a', side: '#b85c4a', bottom: '#a85444', hard: 0.8 },
};

export const HOTBAR = [2, 3, 4, 5, 6, 7];

export const PLAYER = {
  W: 0.6, H: 1.8, EYE: 1.62,
  SPEED: 5.2,
  JUMP_V: 8.2,
  REACH: 6,
};

export const RENDER = {
  DIST: 7,            // 绘制距离（格）
  FOV: 72,            // 度
  FOG: '#bcd8e8',
};

export const COLORS = {
  sky: '#7ec8e3',
  fog: '#bcd8e8',
  hud: 'rgba(8,12,26,0.72)',
  select: '#fbbf24',
  crosshair: 'rgba(255,255,255,0.85)',
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'mini-blocks-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'mini-blocks-save',
};