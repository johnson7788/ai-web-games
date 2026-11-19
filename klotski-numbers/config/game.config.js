// KLOTSKI NUMBERS · 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算棋盘几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 52,           // 顶部 HUD 条高
  MARGIN_X: 24,        // 左右安全边
  MARGIN_Y: 14,
  BOARD_GAP: 8,        // 棋盘与 HUD 间距
  CELL_MAX: 108,       // 单格上限
  BOARD_MAX_W: 640,    // 棋盘最大宽（7×7 也不超）
  BOARD_MAX_H: 560,
};

// 语言：默认英文；zh 必做。未完整翻译的语言整块删除（当前只暴露 en/zh）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'klotski-numbers-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'klotski-numbers-save',
};

// 游戏规则数值（跨关公共项）
export const GAME = {
  SLIDE_SEC: 0.16,       // 一次滑动的动画时长（秒）
  COMBO_MIN: 2,          // 连击从第 2 次连续归位开始计入事件
  DPR_CAP: 2,            // 像素比上限
};
