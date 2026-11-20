// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算棋盘几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 44,            // 顶部 HUD 条高
  MARGIN_X: 22,         // 左右安全边
  MARGIN_Y: 18,
  CELL_MAX: 74,         // 单格上限
  SIDE_W: 212,          // 右侧信息面板宽
};

// 语言：默认英文；zh 必做；未完整翻译的语言整块不暴露（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'jungle-chess-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'jungle-chess-save',
};

// 游戏规则数值（sim 从这里读；跨关公共项）
export const GAME = {
  MOVE_ANIM_S: 0.30,     // 走子动画时长（秒）
  CAPTURE_ANIM_S: 0.55,  // 吃子动画时长（秒）
  AI_THINK_S: 0.45,      // AI 落子前的"思考"时长（秒）
  TUTORIAL_STEPS: 3,
  SHAKE_AMP: 5,
  PLY_LIMIT: 400,        // 完整对局步数上限（超过按子力判负/和）
  SCENES: ['dawn-mist', 'monsoon', 'night-song'],
};
