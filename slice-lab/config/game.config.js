// 全局数值配置（纯常量，sim/render/main 共用）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

// 固定步长（秒）
export const STEP = 1 / 60;

// 过关阈值（1:1 复刻参考玩法：均分 ≥95% 过关）
export const PASS_SCORE = 95;

// 水晶中心（世界坐标）
export const SHAPE_CENTER = { x: 640, y: 380 };

// 切割结算动画时长（秒）
export const SETTLE_SEC = 0.9;

// 星级判定：1★ ≥95 · 2★ ≥98 · 3★ == 100
export const STARS = [
  { min: 100, count: 3 },
  { min: 98, count: 2 },
  { min: 95, count: 1 },
];

// 语言：默认英文；zh 必做；?lang= 可覆盖
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'slice-lab-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'slice-lab-save',
};
