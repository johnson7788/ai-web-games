// 全局常量配置（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js，波次在 config/levels.js，卡牌在 config/cards.js。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  MARGIN: 26,        // 活动区边距（角色碰撞边界）
  ARENA_TOP: 96,     // 顶部 HUD 保留区：敌人与玩家不进入此区域，避免 HUD 遮挡
};

export const STEP = 1 / 60;

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'star-slayer-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'star-slayer-save',
};
