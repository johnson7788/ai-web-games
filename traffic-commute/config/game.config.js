// 全局数值配置（Traffic Commute · 霓虹街机交通问答）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 64,            // 顶部 HUD 条高（不透明，vision-review 要求 HUD 不遮内容）
  QUESTION_H: 0,        // 问题文字并入 HUD
  SCENE_TOP: 64,        // 场景区顶部
  SCENE_H: 656,         // 场景区高度
  OPTION_R: 44,         // 选项标记半径
  MARGIN: 18,
};

// 语言：默认英文；zh 必做；未完整翻译的语言整块删除（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'traffic-commute-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'traffic-commute-save',
};

// 游戏规则数值（sim 从 config/topics.js 读取题目；这里放跨题公共项）
export const GAME = {
  TIME_PER_QUESTION: 20,   // 每题倒计时（秒）
  HINT_PER_RUN: 1,         // 每局提示次数
  COMBO_STAR_AT: 3,        // 连击 ≥3 额外 +1 星
  MAX_STARS: 8,            // 7 题 + 1 连击奖励 = 8
  TUTORIAL_STEPS: 3,       // 首次交互引导步数
};
