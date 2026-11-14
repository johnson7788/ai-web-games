// 全局数值配置 —— Hazard House（本地 1–4 人陷阱生存派对）
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const ARENA = { x0: 70, y0: 140, x1: 1210, y1: 600 };

export const GRID = { ox: 80, oy: 150, cols: 10, rows: 4, tw: 112, th: 110 };

export const PLAYER = {
  R: 20,
  SPEED: 250,
  HP: 3,
  INVULN: 1.2,
};

export const RULES = {
  roundWins: 3,          // 先赢 3 回合夺冠
  countdown: 2.0,
  roundEndDelay: 2.2,
  spikeWarn: 0.9,
  spikeActive: 0.7,
  bombWarn: 1.1,
  bombRadius: 92,
  trapIntervalStart: 1.6,
  trapIntervalMin: 0.55,
};

export const PCOLORS = ['#38bdf8', '#fb7185', '#4ade80', '#fbbf24'];
export const PNAMES = ['P1', 'P2', 'P3', 'P4'];

export const COLORS = {
  bg: '#1a1424',
  floor: '#2c2438',
  floorAlt: '#332a42',
  wall: '#4a3f5e',
  spikeWarn: 'rgba(251,113,133,0.28)',
  spike: '#cbd5e1',
  spikeBase: '#64748b',
  bombWarn: 'rgba(251,191,36,0.3)',
  bomb: '#f97316',
  hud: 'rgba(8,12,26,0.72)',
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'hazard-house-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'hazard-house-save',
};