// 全局常量配置（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js（sim），渲染主题在 src/render/theme.js
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  BASE_X: 96,        // 轨道站（基地）x 位置
  PLAY_ZONE_TOP: 350, // 英雄移动区上界（英雄在底部区域活动）
  PLAY_ZONE_BOTTOM: 690,
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'hero-vanguard-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'hero-vanguard-save',
};
