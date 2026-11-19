// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;
export const DEG = Math.PI / 180;

// 抓钩枢轴（吊杆转轴）与矿坑几何
export const CLAW = {
  pivotX: 640,
  pivotY: 124,
  swingMax: 46 * DEG,        // 左右摆角（相对竖直向下）
  angularSpeed: 1.9,         // 摆速 rad/s
  dropSpeed: 600,            // 下放速度 px/s
  maxLen: 720,               // 下放最大绳长
  floorY: 660,               // 矿坑底
  returnBase: 0.20,          // 回收基础时长 s
  returnPerWeight: 0.06,     // 每重量 +s
  hitMargin: 10,             // 抓取判定余量
  lineSeg: 24,               // 绳节数
};

// 物品类型（value 为抓取即时得分；rock 为负分；carrot 充能）
export const ITEM = {
  gold1:   { kind: 'gold1',   value: 2,  weight: 1, r: 20, label: 'nugget' },
  gold2:   { kind: 'gold2',   value: 5,  weight: 2, r: 24, label: 'nugget' },
  gold3:   { kind: 'gold3',   value: 10, weight: 3, r: 30, label: 'nugget' },
  diamond: { kind: 'diamond', value: 20, weight: 1, r: 18, label: 'diamond' },
  rock:    { kind: 'rock',    value: -3, weight: 3, r: 28, label: 'rock' },
  carrot:  { kind: 'carrot',  value: 0,  weight: 1, r: 20, label: 'carrot' },
};

export const POWER = {
  feverDuration: 4,       // 黄金狂热持续秒
  carrotCharge: 1.0,      // 一根胡萝卜充满
  goldCharge: 0.12,       // 每抓一块金子充能
  feverMultiplier: 2,     // 狂热期间金价翻倍
};

export const COMBO = {
  window: 5,              // 连续窗口秒
  maxBonus: 5,            // 连击奖励封顶
};

export const SCORE = {
  rockPenalty: 3,         // 抓石头扣分
};

// 语言：默认英文；zh 必做
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'bunny-gold-digger-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'bunny-gold-digger-save',
};
