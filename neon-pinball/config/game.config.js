// NEON PINBALL · 全局常量（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键
// 玩法数值在 config/gameplay.js，台面机关在 config/tables.js，渲染主题在 src/render/theme.js
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  PF_LEFT: 300,     // 台面左界
  PF_RIGHT: 980,    // 台面右界
  PF_TOP: 20,       // 台面顶界
  PF_BOTTOM: 716,   // 台面底界（挡板所在）
  DRAIN_Y: 744,     // 球心越过此 y = 掉球（判负）
};

export const STEP = 1 / 60;

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'neon-pinball-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'neon-pinball-save',
};
