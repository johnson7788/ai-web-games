// 全局数值配置（本游戏唯一数值源；玩法数值在 config/levels.js）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 玩法常量（sim / render 共同依赖；不含像素级布局，像素只归 render）
export const GAME = {
  VEIL_Y: 560,          // canvas 上的「夜幕结界」横线 y：算式越过即算遗漏
  SPAWN_Y: -46,         // 算式从屏幕上方之外生成
  SUBJECT_MIN_X: 90,    // 算式横向最左/最右留白（防止被屏幕边缘裁切）
  HUD_H: 44,            // 顶部 HUD 条高（DOM，供 render 计算可见区）
  GOLDEN_EVERY: 8,      // 每第 N 道算式为金色符文（第 8、16、24… 道）
  GOLDEN_BONUS: 50,     // 金色符文额外加分
  BASE_SCORE: 10,       // 每答对一题基础分
  COMBO_SCORE: 2,       // 连击加成：每超出 1 连击多 +(combo-1)*COMBO_SCORE
  MILESTONE_EVERY: 5,   // 每答对 5 题发一次里程碑事件
  TUTORIAL_STEPS: 4,    // 首次交互引导步数
};

// 语言：默认英文；zh 必做。只暴露 locales 里真实存在的语言。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'nightfall-veil-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'nightfall-veil-save',
};
