// 全局数值配置（数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算网格几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 52,            // 顶部 HUD 条高
  BOARD: 560,           // 棋盘边长（7x7 网格外接正方形）
  MARGIN_X: 40,         // 左右安全边
  MARGIN_Y: 18,
  CELL_MAX: 76,         // 单格上限
};

// 语言：默认英文；zh 必做。当前只暴露 en/zh（未翻译语言整块删除，避免豆腐块）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'taichi-flow-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'taichi-flow-save',
};

// 游戏规则数值（sim 从 levels/game.config 读取；这里放跨关公共项）
export const GAME = {
  SIZE: 7,               // 7x7 网格
  PAR_SLACK: 2,          // 2 星区间：par+2 内
  MAX_MOVES_FACTOR: 4,   // 失败上限 = par * factor + 6
  MAX_MOVES_OFFSET: 6,
  COMBO_MIN: 2,          // 一次点击 ≥2 个新匹配 = 连击
  UNDO_MAX: 3,           // 每局可撤销次数
  SHAKE_AMP: 4,          // 连击/胜利小震屏幅度
  TUTORIAL_STEPS: 3,
};
