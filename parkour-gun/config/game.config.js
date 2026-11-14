// 全局数值配置 —— Parkour Gun（横版跑酷射击，单机 + bot）
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const GRAVITY = 2000;
export const GROUND_Y = 660;

// 平台（矩形，可站上面）
export const PLATFORMS = [
  { x: 0, y: GROUND_Y, w: 1280, h: 60 },        // 地面
  { x: 120, y: 520, w: 220, h: 22 },
  { x: 940, y: 520, w: 220, h: 22 },
  { x: 500, y: 440, w: 280, h: 22 },
  { x: 240, y: 340, w: 200, h: 22 },
  { x: 840, y: 340, w: 200, h: 22 },
  { x: 540, y: 250, w: 200, h: 22 },
];

export const PLAYER = {
  W: 30, H: 46,
  SPEED: 300,
  JUMP_V: -720,
  MAX_JUMPS: 2,
  HP: 100,
  RESPAWN: 2.0,
  FIRE_CD: 0.16,
};

export const BULLET = {
  SPEED: 760,
  R: 4,
  LIFE: 0.9,
  DMG: 20,
};

export const RULES = {
  killTarget: 15,
  botCount: 3,
  botFireCd: 0.7,
  botRange: 520,
  botAccuracy: 0.14,
};

export const COLORS = {
  skyTop: '#1a2340',
  skyBottom: '#3a2f5e',
  platform: '#3a4556',
  platformTop: '#52607a',
  ground: '#2c3547',
  blue: '#38bdf8',
  blueDark: '#0c4a6e',
  red: '#fb7185',
  redDark: '#881337',
  bullet: '#fde68a',
  hud: 'rgba(8,12,26,0.72)',
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'parkour-gun-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'parkour-gun-save',
};