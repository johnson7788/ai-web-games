// STORM FIGHTER JET · 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 布局常量：render 据此计算 HUD 高度等（sim 不依赖像素）
export const LAYOUT = {
  HUD_H: 52,            // 顶部 HUD 条高（不透明，避视觉评审误判）
};

// 语言：默认英文；zh 必做。未完整翻译的语言整块删除（当前只暴露 en/zh）。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'storm-fighter-jet-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'storm-fighter-jet-save',
};

// 游戏规则数值（sim 从这里读；levels.js 放跨关公共项）
export const GAME = {
  PLANE_RADIUS: 20,
  MISSILE_RADIUS: 16,
  COIN_RADIUS: 13,
  SHIELD_RADIUS: 16,
  ROCK_RADIUS_MIN: 26,
  ROCK_RADIUS_MAX: 46,
  HIT_RADIUS: 40,           // 玩家与导弹/岩石碰撞半径
  PICKUP_RADIUS: 46,        // 玩家与金币/护盾拾取半径
  MISSILE_MISSILE_RADIUS: 27,
  NEAR_MISS_RADIUS: 64,     // 擦肩而过判定
  COIN_SCORE: 10,           // 单枚金币基础分
  TICK_SCORE: 1,            // 每秒存活得分
  COMBO_WINDOW: 3.0,        // 连击窗口（秒）
  COMBO_STEP: 4,            // 每 N 连击 +1 倍率
  COMBO_MAX_MULT: 5,        // 倍率上限
  SHIELD_SPAWN_EVERY: 11,   // 护盾生成间隔（秒）
  SHIELD_INVULN: 1.6,       // 护盾被消耗后的无敌时间
  STAR_SCORES: [500, 1500, 3200], // 1/2/3 星分数门槛
  COIN_CLUSTERS: [          // 金币群形状（相对偏移，沿用原版集群思路）
    [{ x: 0, y: 0 }, { x: 44, y: 0 }],
    [{ x: 0, y: 0 }, { x: 44, y: 0 }, { x: 88, y: 0 }],
    [{ x: 0, y: 0 }, { x: 30, y: -34 }, { x: 60, y: -68 }, { x: 90, y: -34 }],
    [{ x: 0, y: 0 }, { x: 34, y: 34 }, { x: 68, y: 0 }, { x: 102, y: 34 }],
  ],
};
