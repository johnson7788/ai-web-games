// SNAKE ARENA · 全局常量配置（Lead 所有）
// 世界尺寸 / 固定步长 / 语言 / 存档键。玩法数值在 config/gameplay.js（M1），
// 场次定义在 config/rounds.js，渲染主题在 src/render/theme.js。
export const WORLD = {
  WIDTH: 1280,   // 竞技场逻辑宽（px，即视口，全蛇可见，无相机）
  HEIGHT: 720,   // 竞技场逻辑高（px）
  HUD_TOP: 72,   // 顶部 HUD 预留带（px）：蛇/食物/死亡墙都不进这条带，避免 HUD 遮挡玩法（截图评审会查）
};

export const STEP = 1 / 60; // 固定步长（秒）

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'snake-arena-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'snake-arena-save',
};
