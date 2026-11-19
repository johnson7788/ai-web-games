// 全局数值配置（builder 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算牌桌几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 52,             // 顶部 HUD 条高（不透明，视觉评审不判遮挡）
  PLAYER_Y: 0,           // 由 render 按比例算，这里保留语义
  AI_HAND_H: 96,         // AI 手牌（牌背）区高度
  MY_HAND_Y: 0,
};

// 语言：默认英文；zh 必做；未完整翻译的语言不加入（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'doudizhu-master-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'doudizhu-master-save',
};

// 游戏规则数值（sim 读取；跨局公共项）
export const GAME = {
  BASE_SCORE: 1,           // 底分
  LANDLORD_MULT: 2,        // 地主输赢翻倍
  BOMB_MULT: 2,            // 每出一个炸弹倍率×2
  SPRING_MULT: 2,          // 春天/反春倍率×2
  AI_THINK_MS: 700,        // AI 出牌思考延迟（毫秒）
  MAX_ROUNDS: 50,          // 生涯关卡上限（防溢出）
  TUTORIAL_STEPS: 3,
};
