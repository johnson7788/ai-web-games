// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算桌面几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 52,           // 顶部 HUD 条高
  TILE_W: 46,          // 立牌宽
  TILE_H: 64,          // 立牌高
  TILE_SMALL: 30,      // 对家/侧家盖牌宽
  TABLE_TOP: 64,       // 桌面顶部（对家盖牌区）
  SELF_Y: 588,         // 自家手牌 y 起点
};

// 语言：默认英文；zh 必做（完整翻译后才暴露；当前只 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'mahjong-room-en-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'mahjong-room-en-save',
};

// 游戏规则数值（sim 读取）
export const GAME = {
  ROUNDS: 3,               // 一局打 3 圈（level 1/2/3）
  PLAYERS: 4,
  TILE_TYPES: 34,          // 万/条/筒/风（东南西北中发白）
  COPIES: 4,               // 每种 4 张 → 136 张
  AI_THINK: 0.22,          // AI 每次出牌/响应思考秒数
  SELF_TIMEOUT: 1.4,       // 玩家超时自动出牌/过（秒）
  ENERGY_MAX: 3,           // 能量上限（碰/杠 +1）
  FLUSH_ENABLED: true,     // 清一色 ×2
  STREAK_ENABLED: true,    // 连胜加成（第 n 连胜 ×n）
  LUCKY_ENABLED: true,     // 幸运换牌（3 能量换一次）
  BASE_SCORE: 1,           // 底分
  ZIMO_TIME: 2,            // 自摸倍率（3 × 2 = 6）
  FLUSH_TIME: 2,           // 清一色倍率
};
