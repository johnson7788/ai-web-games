// 全局常量配置：世界尺寸 / 步长 / 语言 / 存档键（玩法数值在 config/gameplay.js）
export const WORLD = {
  WIDTH: 1280,          // 视口宽（逻辑坐标）
  HEIGHT: 720,          // 视口高
  GROUND_Y: 600,        // 地面线 y
  LEVEL_W: 1600,        // 关卡世界宽度（默认；单关可覆盖）
};

export const STEP = 1 / 60;

// 语言：默认英文；本作只做 en/zh（完整才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'heroes-charge-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'heroes-charge-save',
};
