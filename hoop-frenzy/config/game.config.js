// 全局数值配置（HOOP FRENZY · 霓虹街机）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量（render 使用；sim 不依赖像素，只依赖 GAME 数值）
export const LAYOUT = {
  HUD_H: 52,          // 顶部 HUD 条高
  PAD_X: 640,         // 发射台中心
  PAD_Y: 600,         // 发射台高度
  RING_X_L: 250,      // 左环中心 x
  RING_X_R: 1030,     // 右环中心 x
  RIM_R: 42,          // 环外径
  BALL_R: 15,         // 能量球半径
  METER_Y: 668,       // 力量条 y
  METER_W: 360,       // 力量条宽
};

// 语言：默认英文；zh 必做；只暴露已完整翻译的语言
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'hoop-frenzy-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'hoop-frenzy-save',
};

// 玩法数值（sim 读取）
export const GAME = {
  WIN_SCORE: 22,          // 达到即胜
  LIVES: 3,               // 每局生命（时钟耗尽扣 1）
  STAGE_UP_GOALS: 2,      // 每进 N 球升 1 阶段
  GOLDEN_EVERY: 4,        // 每 N 球出现金环（双倍分）
  OFF_TIME_0: 6.0,        // 初始单球时钟（秒）
  OFF_TIME_DECAY: 0.12,   // 每球递减
  OFF_TIME_MIN: 2.6,      // 单球时钟下限
  METER_PERIOD: 0.9,      // 力量条完整扫动周期（秒）
  RECOVER_TIME: 0.35,     // 未中后回球时间（秒）
  RING_BASE_Y: 380,       // 环基准 y（理想力量 0.5 对应）
  RING_BASE_MIN: 300,     // 环随机 y 下界
  RING_BASE_MAX: 460,     // 环随机 y 上界
  AIM_K: 0.0025,          // 环 y 偏移 → 理想力量偏移
  CLEAN_TOL: 0.05,        // 空心容差（阶段 1-2）
  BANK_TOL: 0.14,         // 擦板容差（阶段 1-2）
  NEAR_MISS: 0.06,        // 擦板外再放宽 N 视为「差一点」
  // 阶段难度（index = stage，1 起）
  STAGES: [
    { clean: 0.05, bank: 0.14, bobAmp: 0,  bobSpeed: 0 },   // 1 静态环
    { clean: 0.05, bank: 0.14, bobAmp: 0,  bobSpeed: 0 },   // 2 金环出现
    { clean: 0.045, bank: 0.12, bobAmp: 46, bobSpeed: 1.7 }, // 3 环开始漂移
    { clean: 0.038, bank: 0.10, bobAmp: 70, bobSpeed: 2.4 }, // 4 环更小更快
    { clean: 0.034, bank: 0.09, bobAmp: 86, bobSpeed: 3.0 }, // 5 极速
  ],
};
