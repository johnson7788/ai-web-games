// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算道路/车辆/生成几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 52,            // 顶部 HUD 条高（不透明，避免被 vision-review 判遮挡）
  ROAD_L: 300,          // 道路左缘
  ROAD_R: 980,          // 道路右缘
  LANE_CX: [380, 550, 730, 900], // 4 车道中心 x（car1 走 0/1，car2 走 2/3）
  CAR_Y: 600,           // 车辆所在 y（碰撞线）
  SPAWN_Y: -50,         // 实体生成 y（屏幕上方外）
  CAR_W: 82,
  CAR_H: 128,
};

// 语言：默认英文；zh 必做；只暴露 en/zh
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'frenzy-racer-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'frenzy-racer-save',
};

// 游戏规则数值（sim 从 levels 读取；这里放跨关公共项）
export const GAME = {
  SWITCH_MS: 90,         // 换道动画时长（仅视觉；逻辑瞬时切换）
  STAR_SCORE: 10,        // 单星基础分
  COMBO_BONUS: 2,        // 连击加分系数（score += STAR_SCORE * combo）
  SHIELD_CAP: 1,         // 护盾上限
  RATING_BONUS: 0.25,    // 每档星级额外收集率（goal + n*0.25）
  TUTORIAL_STEPS: 3,
};
