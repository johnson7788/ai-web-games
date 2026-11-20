// ACE GUNNER · 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做。未完整翻译的语言整块删除（当前只暴露 en/zh）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'ace-gunner-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'ace-gunner-save',
};

// 布局常量：render 由此计算城墙/道路几何（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 56,            // 顶部 HUD 条高
  WALL_X: 150,          // 城墙内立面 x（敌人到达即攻城）
  ARCHER_X: 150,        // 射手站立 x
  ARCHER_Y: 250,        // 射手站立 y（城垛上方，与城门分开，避免重叠）
  ROAD_TOP: 120,        // 道路上方 y（含 HUD 下留白）
  ROAD_BOT: 700,        // 道路下方 y
  SPAWN_X: 1240,        // 敌人出生 x
};

// 游戏规则数值（sim 从这里读取跨关公共项；单关数值在 config/levels.js）
export const GAME = {
  BASE_HP: 100,          // 城门初始血量
  BASE_MAX_HP: 100,
  QUIVER: 8,             // 箭袋容量
  RELOAD_TIME: 1.15,     // 换弹秒数（换弹窗口取舍）
  FIRE_COOLDOWN: 0.26,   // 两箭最小间隔
  ARROW_SPEED: 760,      // 箭矢速度 px/s
  ARROW_DAMAGE: 12,      // 满弦基础伤害
  ARROW_RADIUS: 6,       // 箭矢判定半径
  RANGE: 540,            // 有效射程
  CHARGE_MAX: 1.4,       // 拉满弦伤害倍率上限
  CHARGE_MIN: 0.6,       // 未拉弦伤害倍率下限
  CHARGE_TIME: 0.5,      // 拉满所需秒数
  EAGLE_STREAK: 3,       // 连杀触发鹰眼时刻所需连杀
  EAGLE_DURATION: 2.6,   // 鹰眼持续秒数
  EAGLE_TIMESCALE: 0.4,  // 鹰眼慢动作倍率
  EAGLE_EXTEND: 0.6,     // 鹰眼内每次击杀延长秒数
  KILL_STREAK_WINDOW: 4, // 连杀断连窗口秒数
  UPGRADES_PER_WAVE: 3,  // 每次升级屏可选数
  TUTORIAL_STEPS: 3,
  SHAKE_AMP: 5,
};

// 三场景色板（render 用；一眼可分：正午荒漠 / 沙暴边境 / 星夜要塞）
export const SCENES = ['noon-desert', 'sandstorm-border', 'starry-fortress'];
