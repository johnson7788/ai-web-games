// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 玩法数值（sim 从这里读跨关公共项）
export const GAME = {
  GRAVITY_TICK: 1 / 16,        // 每个物理 tick 的秒数（珠子每格下落 ≈0.0625s，蜂蜜粘稠感）
  SHAKE_AMP: 3,                // 拉闸/收集时的小震屏幅度（px）
  TUTORIAL_STEPS: 3,
};

// 语言：默认英文；zh 必做；ja/ko/ar/ru 完整翻译后才加入（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'pin-and-pour-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'pin-and-pour-save',
};

// 布局常量：render 由此计算容器几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 44,             // 顶部 HUD 条高
  MARGIN_X: 40,          // 左右安全边
  MARGIN_Y: 52,          // 顶部留白给目标图例
  CELL_MAX: 96,          // 单格上限
  BOTTLE_W: 84,          // 收集瓶绘制宽度
};
