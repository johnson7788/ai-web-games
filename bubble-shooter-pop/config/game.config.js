// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 由此计算几何（sim 不依赖像素之外的常量，但共用 WORLD/GAME）
export const LAYOUT = {
  HUD_H: 46,            // 顶部 HUD 条高
  GROUND_Y: 700,        // 炮台基座线
};

// 语言：默认英文；zh 必做；只暴露 en/zh
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'bubble-shooter-pop-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'bubble-shooter-pop-save',
};

// 游戏规则数值（跨局公共项；sim 从 config/levels.js 读取关卡参数，这里放常量）
export const GAME = {
  // 炮台
  CANNON_Y: 656,        // 炮台中心 y
  CANNON_W: 72,
  CANNON_H: 54,
  CANNON_MIN_X: 56,
  CANNON_MAX_X: 1224,
  CANNON_SPEED: 540,

  // 射击
  SHOOT_INTERVAL: 0.34, // 自动射击间隔（秒）
  RAPID_MULT: 3,        // 急速射击倍率
  BURST_COOLDOWN: 0.42, // 手动连发冷却
  BULLET_SPEED: 920,
  BULLET_R: 6,
  BULLET_DAMAGE: 2,

  // 泡泡
  BUBBLE_R: 34,
  BUBBLE_ROCK_R: 40,
  BUBBLE_GOLD_R: 30,
  BUBBLE_BOMB_R: 38,
  BASE_FALL: 92,        // 第 1 波下落速度
  FALL_PER_WAVE: 10,    // 每波加速
  FALL_CAP: 230,
  BASE_SPAWN: 3.0,      // 第 1 波出生间隔
  SPAWN_PER_WAVE: 0.26, // 每波缩短
  SPAWN_MIN: 0.9,
  POPS_PER_WAVE: 8,     // 每波需要击破的泡泡数
  EXPIRE_TIME: 6.5,     // 泡泡未击破自动消失（miss）
  MISS_LIMIT: 6,        // 放走 6 个泡泡即游戏结束（漏接惩罚）
  BOMB_RADIUS: 96,

  // 连击
  COMBO_MILESTONE: 10,  // 每 10 连击触发一次音效提示

  // 道具
  POWERUP_FALL: 120,
  RAPID_TIME: 8,
  TRIPLE_TIME: 8,

  // 星级阈值（按最终分数）
  STAR_2: 500,
  STAR_3: 1500,
};
