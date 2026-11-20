// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做。未完整翻译的语言整块删除（当前只暴露 en/zh）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'word-duel-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'word-duel-save',
};

// 跨关公共战斗数值（sim 从 levels/word 读取；这里放公共项）
export const GAME = {
  PLAYER_MAX_HP: 100,
  HAND_SIZE: 9,             // 每回合手牌字母数
  SWAP_SIZE: 3,             // 一次换牌弃掉/补充的字母数
  DAMAGE_BASE: 6,           // 基础伤害
  DAMAGE_PER_LEN: 6,        // 每字母伤害
  SPEED_BONUS_MAX: 8,       // 提交越快伤害加成上限
  HEAL_PER_LEN: 4,          // heal 词每字母回血
  TUTORIAL_STEPS: 3,
  SHAKE_AMP: 5,
};
