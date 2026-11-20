// 全局常量配置：世界尺寸 / 步长 / 语言 / 存档键。
// 玩法数值在 config/gameplay.js，关卡在 config/levels.js，渲染主题在 src/render/theme.js。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_Y: 660, // 摊位/水面基线（渲染装饰用）
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露，其他语言整块不暴露）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'carnival-shot-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'carnival-shot-save',
};
