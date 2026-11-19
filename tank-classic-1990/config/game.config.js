// 全局数值配置（Lead 拥有；数值改动只改这里）
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 棋盘几何：26×26 格、每格 24px，居中放置（HUD 顶部 52px 不透明条）
export const BOARD = {
  TILE: 24,
  COLS: 26,
  ROWS: 26,
  OX: (1280 - 26 * 24) / 2, // 328
  OY: 52,
};

// 语言：默认英文；zh 必做（完整翻译后才暴露）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'tank-classic-1990-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'tank-classic-1990-save',
};

// 玩法规则数值（sim 读取）
export const GAME = {
  TANK_SIZE: 42,          // 坦克边长（<2 格，允许在 1 格宽窄缝里通过）
  BULLET_SIZE: 8,
  PLAYER_SPEED: 132,      // px/s
  ENEMY_SPEED: 84,
  SCOUT_SPEED: 132,
  BULLET_SPEED: 340,
  PLAYER_FIRE_CD: 0.32,
  ENEMY_FIRE_CD: 1.7,
  GUNNER_FIRE_CD: 0.7,
  COMBO_WINDOW: 4.0,      // 连击窗口（秒）
  PLAYER_LIVES: 3,
  SPAWN_INTERVAL: 1.7,    // 敌人生成间隔（秒）
  MAX_ACTIVE: 4,          // 场上最大敌军数
  POWERUP_DROP: 0.18,     // 破坏砖/岩掉道具概率
  POWERUP_TTL: 12,
  FREEZE_TIME: 4,
  SHIELD_TIME: 8,
  RAPID_TIME: 8,
  RESPAWN_INVULN: 2.0,
  SPAWN_INVULN: 1.0,
  STAR_LIVES: 2,          // 剩余生命 ≥2 → +1 星
  STAR_COMBO: 4,          // 最大连击 ≥4 → +1 星
};
