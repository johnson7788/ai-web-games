// 全局常量配置（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键。
// 玩法数值在 config/tea.js（茶杯 / 水温 / 客人 / 天数 / 场景 / 升级）。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'water-ritual-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'water-ritual-save',
};
