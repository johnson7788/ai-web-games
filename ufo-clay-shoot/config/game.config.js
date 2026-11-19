// UFO CLAY SHOOT · 全局数值配置（P0 玩法事实表数值 1:1 移植自参考源码，主题换皮）
// 参考：local/batch3/extracted/飞碟射击-creator/assets/Script/{Game,Player,Enemy*,Asteroid,Coin,Ammo}.ts

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  HUD_H: 60,          // 顶部不透明 HUD 条高度（实体活动区从 y=HUD_H+margin 开始，避免遮挡）
  PLAY_TOP: 84,       // 敌人/掉落物出生与活动的上边界
  PLAY_BOTTOM: 720,   // 玩家活动下边界
};

export const STEP = 1 / 60;

export const PLAYER = {
  WIDTH: 54,
  HEIGHT: 46,
  X_ACCELERATION: 3200,   // 原 Player.ts X_ACCELERATION
  Y_ACCELERATION: 2300,   // 原 Player.ts Y_ACCELERATION
  DAMP: 0.8,              // 原 Player.ts DAMP
  AMMO_START: 12,         // 原 Game.ts AMMO_PER_BOX
  Y_BASE: 656,            // 玩家飞船中心 y（贴近底部）
  LEFT_BOUND: 40,
  RIGHT_BOUND: 1240,
  TOP_BOUND: 120,
  BOTTOM_BOUND: 692,
  MAX_HP: 3,              // 新机制 · 生命值（原作为一击死，改为 3 命 + 受击无敌帧，更耐玩）
  POST_HIT_GRACE: 1.5,    // 受击后无敌帧（秒）
};

export const LASER = {
  SPEED: 1400,            // 原 LaserBlue 475 → 提到 1400：街机激光应接近瞬发，也利于命中漂移的飞碟
  W: 7,
  H: 22,
  COOLDOWN: 0.16,         // 连发限流（秒）
};

// 敌机：小/中/大（原 EnemySmall/Medium/Big 数值 1:1）
export const ENEMIES = {
  small: {
    w: 46, h: 32, hp: 1,
    FIRE_RATE: 1.8, BULLET_BURST: 5, LASER_INTERVAL: 0.04,
    X_ACCELERATION: 850, Y_SPEED: -70, LASER_SPEED: 270,
    score: 40,
  },
  medium: {
    w: 60, h: 42, hp: 2,
    FIRE_RATE: 2.0, BULLET_BURST: 2, LASER_INTERVAL: 0.15,
    X_ACCELERATION: 300, Y_SPEED: -60, LASER_SPEED: 240,
    score: 90,
  },
  big: {
    w: 76, h: 54, hp: 3,
    FIRE_RATE: 2.0, FAN_BULLETS: 7, FAN_SPREAD: 12.5, FAN_OFFSET: -37.5,
    X_ACCELERATION: 110, Y_SPEED: -45, LASER_SPEED: 130,
    score: 180,
  },
};

export const ASTEROID = {
  SPAWN_RATE: 1.2,        // 原 Game.ts ASTEROID_SPAWN_RATE
  R: 26,                  // 半径（原 scale 0.3 的小行星）
  Y_MIN: -50, Y_MAX: -270,// 原 spawnAsteroid 线性速度
  X_SPEED: 20,
  ROT_SPEED: 100,         // 原 Asteroid.rotationSpeed
  score: 25,
};

export const COIN = {
  SPAWN_RATE: 1.45,       // 原 Game.ts COIN_SPAWN_RATE
  SPEED: 125,             // 原 Coin.coinSpeed
  R: 14,
  INVINCIBLE_AT: 10,      // 原 updateCoinScore：10 币 → 无敌
  INVINCIBLE_DURATION: 5, // 原 Game.ts INVINCIBLE_DURATION
  score: 5,
};

export const AMMO = {
  SPAWN_RATE: 7.1,        // 原 Game.ts AMMO_SPAWN_RATE
  PER_BOX: 12,            // 原 Game.ts AMMO_PER_BOX
  SPEED: 95,              // 原 spawnAmmo 线性速度
  R: 15,
};

// 新机制 · 三连发道具（换皮新增）
export const POWERUP = {
  SPAWN_RATE: 13.0,
  SPEED: 90,
  R: 16,
  DURATION: 8,            // 三连发持续秒数
};

export const ENEMY_SPAWN = {
  RATE_START: 8,          // 原 Game.ts ENEMY_SPAWN_RATE = 8
  RATE_MIN: 2.4,          // 难度爬坡下限（新机制 · 节奏递增）
  RAMP_OVER: 90,          // 90s 内从 8s 线性降到 2.4s
};

export const COMBO = {
  WINDOW: 2.5,            // 连击窗口（秒），无击杀即重置
  MAX_BONUS: 10,          // 连击加成封顶：multiplier = 1 + 0.2 * min(combo-1, MAX_BONUS)
};

export const STAR_THRESHOLDS = [0, 25, 50, 80]; // 存活秒数 → 1/2/3 星（结算评级）

export const WAVE_SEC = 16; // 每 16s 进入下一波（levelsReached = floor(time/WAVE_SEC)+1）

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],   // 只暴露完整翻译的语言
  rtlLangs: [],
  langStorageKey: 'ufo-clay-shoot-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'ufo-clay-shoot-save',
};
