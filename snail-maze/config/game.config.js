// 全局数值配置（数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'snail-maze-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'snail-maze-save',
};

// 玩法数值（sim 读取；跨关公共项）
export const GAME = {
  SPEED_SCALE: 60,       // 参考 speed（px/frame）×60 = px/s
  CORRIDOR_HALF: 125,    // 中心线到墙的半宽
  MARGIN: 90,            // 拐角 overshoot 容差（超过即撞墙）
  PRE_WINDOW: 24,        // 拐角前提前可转的容差
  BASH_WINDOW: 80,       // 岩石「壳击」判定半窗
  NEAR_ROCK: 220,        // 岩石预警距离
  COMBO_MAX: 5,          // 连击上限
  ROCK_PENALTY: 5,       // 撞岩石扣分
  ORB_SCORE: 10,         // 每颗星尘基础分（×连击）
  BASH_SCORE: 25,        // 壳击岩石奖励分
};
