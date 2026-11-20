// 全局常量配置（Lead 所有）：世界尺寸 / 步长 / 语言 / 存档键。
// 玩法数值在 config/gameplay.js；关卡数据在 config/levels.js。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_Y: 600,      // 地面顶边（所有关卡地面段默认 top）
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'q-adventure-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'q-adventure-save',
};
