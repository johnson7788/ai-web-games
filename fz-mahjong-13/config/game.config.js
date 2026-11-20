// FZ MAHJONG 13 · 全局配置（纯逻辑数值 + 布局 + 语言声明）
// 牌组沿用福州麻将 1:1：筒 11-19 / 万 21-29 / 条 31-39 / 风箭 41-47 / 花 51-58

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 牌 ID 常量（与源码 TileType 对齐）
export const TILE = {
  BING: 11, WAN: 21, TIAO: 31,   // 序数牌起点
  DONG: 41,                        // 风箭起点（也是「金」抽取上限：< DONG 才是序数牌）
  SPRING: 51,                      // 花牌起点
  TOTAL: 144,
};

// 胡牌番型（与源码 K_WIN_* 对齐）
export const WIN = {
  NONE: 0,
  PINGHU: 1,     // 平胡
  JINQUE: 2,     // 金雀（两金全成组）
  THREEJIN: 3,   // 三头金（三金）
};

export const WIN_SCORE = {
  [WIN.PINGHU]: 100,
  [WIN.JINQUE]: 220,
  [WIN.THREEJIN]: 340,
};

// 座位：0=自己(下) 1=右 2=对(上) 3=左
export const SEATS = 4;

// 道具
export const ITEMS = {
  hint:     { id: 'hint',     cost: 10, perRound: 2 },
  reJoker:  { id: 'reJoker',  cost: 30, perRound: 1 },
  backDraw: { id: 'backDraw', cost: 20, perRound: 1 },
};

// 玩家手气加成（casual 辅助：摸牌时从「最有利 3 张」里择一）
export const LUCK = {
  enabled: true,
  candidates: 3,     // 摸牌时挑 3 张候选，取对胡牌最有利的一张
};

// 计分
export const SCORE = {
  flower: 30,            // 每张花 +30
  streakCap: 4,          // 连胜倍率封顶
  streakStep: 0.5,       // 每连胜 1 局 ×(1 + 0.5*streak)
};

// 语言：默认英文；zh 必做（brief 要求 en 默认 + zh 完整）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'fz-mahjong-13-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'fz-mahjong-13-save',
};

// 渲染布局（供 renderer / ui 定位用）
export const LAYOUT = {
  // 牌桌四个方向的手牌区域（世界坐标）
  selfHand: { x: 640, y: 640, tileW: 46, tileH: 62 },
  rightHand: { x: 1150, y: 360, tileW: 30, tileH: 42 },
  topHand: { x: 640, y: 96, tileW: 30, tileH: 42 },
  leftHand: { x: 130, y: 360, tileW: 30, tileH: 42 },
  discards: { centerX: 640, centerY: 380 },
};
