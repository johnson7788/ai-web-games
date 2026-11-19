// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算泳道/目标面板几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 48,            // 顶部 HUD 条高
  TARGET_H: 84,         // 目标卡描述面板高
  LANE_TOP: 140,        // 泳道区起始 y
  LANE_BOTTOM: 700,     // 泳道区结束 y
  CARD_W: 96,           // 卡宽
  CARD_H: 128,          // 卡高
  LANE_GAP: 40,         // 同泳道相邻卡间距（px）
};

// 语言：默认英文；zh 必做；只暴露 en/zh
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'poker-rush-7-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'poker-rush-7-save',
};

// 游戏规则数值（sim 从 levels/game.config 读取；这里放跨关公共项）
export const GAME = {
  LANE_COUNT: 4,            // 泳道数
  INITIAL_PER_LANE: 5,      // 每泳道初始卡数
  REVEAL_SEC: 2.6,          // 目标卡展示时长（倒计时结束后）
  COMBO_STEP: 10,           // 每 N 连倍率 +1
  STAR_COMBO_2: 4,          // 2 星最低 maxCombo
  STAR_COMBO_3: 8,          // 3 星最低 maxCombo（且 0 漏接）
  BASE_SCORE: 10,           // 单次点对基础分
  MISS_BASE: 3,             // 漏接上限基数（关卡 canMissRate 微调）
  SHAKE_AMP: 4,             // 点对/点错小震屏幅度（px）
};
