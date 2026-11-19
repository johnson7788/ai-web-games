// 全局数值配置（海盗逃命 · neon arcade runner）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  // 渲染：两赛道在水平方向相对中心的偏移（与参考原作的 -90/+90 一致）
  LANE_OFFSET: [-90, 90],
  ITEM_OFFSET: [-130, 130],
  HERO_Y: 430,        // 主角固定屏幕 y
  ROW_PX: 56,         // 每「米/行」的像素高度
  WATER_CLAMP: [420, 712],
};

export const STEP = 1 / 60;

export const RULES = {
  START_HEIGHT: 2.0,  // 起始高度（米），给玩家约 2.7s 首次输入窗口
  STEP_HEIGHT: 1.0,   // 每次攀爬 +1 米
  SINK0: 0.75,        // 初始下坠速度（米/秒）
  SINK_STEP: 0.15,    // 每档 +0.15 米/秒
  TIER_EVERY: 30,     // 每 30 分一档速度
  COMBO_EVERY: 10,    // 每 10 连击发一次奖励
  COMBO_COIN: 2,      // 连击奖励金币
  SAFE_ROWS: 2,       // 前 2 行无木板（安全起步）
  DASH_RATE: 9.0,     // 冲刺：每秒自动爬 9 行
  DASH_TIME: 2.2,     // 冲刺时长
  MAGNET_TIME: 8.0,   // 磁铁时长
  SHIELD_TIME: 15.0,  // 护盾时长（未受击则到时失效）
  RATING: [10, 40, 80], // 1/2/3 星评分所需高度
};

export const ITEMS = {
  // 每行每个赛道的物品生成概率（累积）
  COIN_P: 0.45,
  STAR_P: 0.08,       // 相对 COIN_P 之后
  BOX_P: 0.02,        // 相对 STAR_P 之后
};

// 语言：默认英文；zh 必做。只有 en/zh 完整，因此只暴露这两种。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'pirate-escape-run-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'pirate-escape-run-save',
  tutKey: 'pirate-escape-run-tut',
};
