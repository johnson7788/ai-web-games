// 全局常量配置（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键。
// 玩法数值（牌、番型、12 局推进、场景包、AI 强度）在 config/rules.js。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露），其它语言整块不出现。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'penta-cards-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'penta-cards-save',
};
