// WANHAO CASINO · 全局数值配置
// 玩法骨架源自「推饼/二锅头」：庄家 vs 三门，两张牌比点，对子>点数，和局庄吃。
// 主题换皮为霓虹街机赌场，新增 3 机制：万能牌 / 连胜倍率 / 多门连击。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  HUD_H: 60,        // 顶部 HUD 条高度（DOM，不透明背板）
  ACTION_H: 100,    // 底部动作条高度（DOM，不透明背板）
};

export const STEP = 1 / 60;

// 三门（原「南/天/北」→ 霓虹三门）
export const DOORS = [
  { key: 'sun',   en: 'Sun',   zh: '太阳门', color: '#ffb300', glow: '#ffd54f' },
  { key: 'moon',  en: 'Moon',  zh: '月亮门', color: '#29d6ff', glow: '#8ee8ff' },
  { key: 'star',  en: 'Star',  zh: '星门',   color: '#ff4fd8', glow: '#ff9ef0' },
];

// 庄家（House）位置顺序：开牌顺序（骰子决定，这里保留原味 4 手：庄 + 三门）
export const HAND_ORDER = ['house', 'sun', 'moon', 'star'];

// 牌面 1..9；0 = 万能牌（Joker）
export const TILE_MIN = 1;
export const TILE_MAX = 9;
export const JOKER = 0;

// 筹码档位
export const CHIP_SIZES = [100, 500, 1000, 5000, 10000];

// 单局数值
export const GAME = {
  START_CHIPS: 50000,       // 初始筹码
  MIN_BET: 100,             // 最低下注
  MAX_ROUNDS: 8,            // 一局 8 轮
  JOKER_CHANCE: 0.12,       // 万能牌出现概率（每张牌，第 2 轮起）
  JOKER_CHANCE_HIGH: 0.2,   // 第 7 轮起提高
  STREAK_CAP: 3.0,          // 连胜倍率上限
  ROLL_TIME: 1.1,           // 骰子滚动时长
  REVEAL_INTERVAL: 0.55,    // 每手翻牌间隔
  SETTLE_TIME: 1.15,        // 结算展示时长
};

// 语言：默认英文；zh 必做。只暴露 locales 里真实存在的语言。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'wanhao-casino-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'wanhao-casino-save',
};
