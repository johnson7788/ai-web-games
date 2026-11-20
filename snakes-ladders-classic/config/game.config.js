// 全局数值配置
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 游戏规则常量
export const GAME = {
  HUMAN_SEAT: 0,          // 玩家座位号
  PLAYER_COUNT: 3,        // 1 玩家 + 2 对手（节奏更快，单人竞速）
  HOP_TIME: 0.07,         // 每格跳跃动画时长（秒）
  SLIDE_TIME: 0.45,       // 梯子/蛇滑动动画时长（秒）
  AI_DIE_SIDES: 4,        // 对手只掷 1-4（"谨慎的对手"，玩家有优势）
  HUMAN_DIE_SIDES: 6,     // 玩家掷 1-6
  MAX_ROLLS: 400,         // 单局最大掷骰次数（防死循环）
};

// 语言：默认英文；zh 必做。只暴露 locales 里真实存在的语言。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'snakes-ladders-classic-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'snakes-ladders-classic-save',
};
