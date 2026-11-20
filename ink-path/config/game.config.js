// INK PATH · 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算星网几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 52,            // 顶部 HUD 条高
  MARGIN: 56,           // 星网四周安全边
  STAR_R_MIN: 13,       // 星子半径下限（节点多时变小）
  STAR_R_MAX: 20,
  HIT_R: 34,            // 点击命中半径
};

// 语言：默认英文；zh 必做；未完整翻译的语言整块删除（当前只暴露 en/zh）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'ink-path-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'ink-path-save',
};

// 游戏规则数值（跨关公共项）
export const GAME = {
  // 星级：步数 == 最优步数 → 3 星；≤ 最优×(1+50%) → 2 星；其余 1 星。
  STAR_SLACK: 0.5,
};
