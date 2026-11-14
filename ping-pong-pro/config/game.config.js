// 全局数值配置：逻辑层不写死数字。
export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

export const TABLE = { X: 340, Y: 60, W: 600, H: 600 };
export const PADDLE = { W: 120, H: 16, PLAYER_Y: 624, AI_Y: 96 };
export const BALL_R = 12;

export const COLORS = {
  bg: '#0a1410',
  bgGlow: '#14241c',
  table: '#1a6b4a',
  tableEdge: '#0f4a32',
  line: 'rgba(255,255,255,0.7)',
  player: '#60a5fa',
  ai: '#fb7185',
  ball: '#f8fafc',
  ink: '#eef2f6',
  accent: '#fbbf24',
  panel: '#10201a',
  panelEdge: '#2c4034',
};

export const RULES = {
  winScore: 7,
  ballSpeed: 400,
  ballSpeedInc: 18,
  maxBallSpeed: 760,
  paddleSpeed: 560,
  aiSpeed: 400,
  serveDelay: 1,
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'ping-pong-pro-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'ping-pong-pro-save',
};