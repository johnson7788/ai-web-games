// LADDER CLIMBER · 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做。只暴露 locales 里真实存在的语言。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'ladder-climber-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'ladder-climber-save',
};

// 玩法数值（sim 从这里读；与参考源码的 P0 数值对齐后加新机制）
export const GAME = {
  STEP_HALF: 71.5,        // 正式阶梯相对上一层横向偏移（ladW/2）
  STEP_H: 82,             // 层高（ladH）
  RIDE_H: 65,             // 玩家站立点相对阶梯中心的高度
  COLLAPSE_START_MS: 1000,// 初始塌陷间隔（ms）
  COLLAPSE_STEP_MS: 5,    // 每塌一层间隔递减（ms）
  COLLAPSE_MIN_MS: 350,   // 塌陷间隔下限（ms，改造：原版会减到 0 秒瞬塌）
  COMBO_WINDOW: 1.0,      // 连击判定窗口（s）：超过则连击归零
  COMBO_MAX: 9,           // 连击封顶
  STAR_SCORE: 5,          // 星星分值
  ORB_SCORE: 10,          // 冰冻道具分值
  STAR_SHIELD_NEED: 3,    // 攒满 3 星得 1 护盾
  SHIELD_MAX: 2,          // 护盾上限
  FREEZE_SEC: 3.0,        // 冰冻道具冻结塌陷秒数
  READY_AUTO_SEC: 3.0,    // 开局无输入多久后自动启动塌陷（防无限挂机）
  STAGE_FLOORS: 20,       // 每爬满多少层进一个新阶段（视觉换色 + stage 事件）
  TUTORIAL_STEPS: 3,      // 首次交互引导步数
};
