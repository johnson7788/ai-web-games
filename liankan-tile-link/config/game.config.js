// 全局数值配置（唯一数值源）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 玩法数值
export const GAME = {
  memorizeTime: 5,        // 记忆阶段秒数（牌正面朝上）
  timedBase: 30,          // 计时模式基础秒数
  timedBonus: 5,          // 每组配对成功奖励秒数
  comboBonusAt: 2,        // 连击达到 N 起额外奖励
  comboBonusSec: 1,       // 每级连击额外秒数（combo-At+1）
  peekEveryMatches: 3,    // 每 N 次配对积 1 个窥视充能
  peekDuration: 0.8,      // 窥视持续秒数
  peekMax: 3,             // 窥视充能上限
  peekStart: 1,           // 开局赠送充能
  matchLock: 0.3,         // 配对成功短暂锁输入
  mismatchLock: 0.9,      // 配对失败锁输入（牌翻回）
};

// 语言：默认英文；zh 必做。未翻译的语言整块删除，不要留半成品。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'liankan-tile-link-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'liankan-tile-link-save',
};
