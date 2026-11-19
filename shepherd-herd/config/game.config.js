// 全局数值与运行时配置：世界尺寸 / 固定步长 / 玩法常量 / 语言与存档。
// 美术全部程序化（canvas 霓虹街机），零素材文件零外链。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  // 羊群活动区（避开顶部 HUD 与底部喂食槽）
  FIELD: { left: 42, top: 120, right: 1238, bottom: 650 },
  TRAY: { x: 640, y: 668 },
};

export const STEP = 1 / 60;

// 玩法常量（P0 数值 1:1 保留：cd 0.5s / 开局倒计时 1.5s）
export const PLAY = {
  SHEEP_R: 30,          // 羊半径（点按判定 + 绘制）
  TAP_MARGIN: 16,       // 点按判定外扩
  FLIGHT_SEC: 0.30,     // 能量种子飞行时长
  COMBO_WINDOW: 2.0,    // 连击窗口（秒）
  GOLDEN_TIME_BONUS: 2, // 金色羊奖励时间（秒）
  GOLDEN_SPEED: 1.45,   // 金色羊移动倍率
  BASE_SCORE: 100,      // 单次喂食基础分
  COMBO_SCORE: 25,      // 每级连击附加分
  GOLDEN_SCORE: 250,    // 金色羊附加分
};

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'shepherd-herd-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'shepherd-herd-save',
};
