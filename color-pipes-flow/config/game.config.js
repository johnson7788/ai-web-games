// COLOR PIPES FLOW · 全局数值配置
// 画布 16:9；sim 只给行列，像素换算全部在 render 完成。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做（一线语言）。当前只暴露 en/zh。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'color-pipes-flow-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'color-pipes-flow-save',
};

// 跨关公共规则数值（关卡级数值在 config/levels.js）
export const GAME = {
  HUD_H: 44,          // 顶部 HUD 条高
  DPR_MAX: 2,         // 高清屏像素比上限
  IDLE_LIMIT: 240,    // 秒：无操作提示（不自动判负，仅 UI 提示）
  TUTORIAL_STEPS: 3,
  SHAKE_AMP: 4,
};
