// 全局常量配置（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js 与 config/levels.js；物品库在 config/items.js。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  HUD_H: 96,        // 顶部不透明 HUD 区（清单/计时/电量），物品不落进这里
  PLAY_TOP: 118,    // 可玩区域（物品可放置/手电可扫）上边界
  PLAY_BOTTOM: 704, // 可玩区域下边界
  PLAY_LEFT: 40,
  PLAY_RIGHT: 1240,
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'spot-it-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'spot-it-save',
};
