// 全局常量配置（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js，赛道与 12 站 GP 在 config/tracks.js
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  MAP_SIZE: 2048, // 赛道贴图（世界坐标）边长，世界坐标中心 (0,0)
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'cake-kart-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'cake-kart-save',
};
