// 全局常量配置：世界尺寸 / 步长 / 语言 / 存档键。
// 玩法与关卡数值在 config/levels.js；渲染主题在 src/render/theme.js（场景包色板）。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  GOAL_TOP: 118,    // 目标横幅下方（画布可交互区的上边缘）
  GOAL_BOTTOM: 660, // 可交互区下边缘（给丘比特/状态栏留空间）
};

export const STEP = 1 / 60;

// 长按（hold）判定：按住不松手超过该时长即触发，属于本作新增交互。
export const HOLD_MS = 1200;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'kiss-collector-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'kiss-collector-save',
};
