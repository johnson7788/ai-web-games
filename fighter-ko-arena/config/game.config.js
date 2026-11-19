// 全局数值配置：霓虹街机 1v1 格斗
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_Y: 566,
};

export const STEP = 1 / 60;

// 格斗核心数值（与 P0 源码节奏对齐：接近→近身→出拳/扫腿，敌方自动还击）
export const FIGHT = {
  PLAYER_HP: 100,
  START_GAP: 760,          // 开局双方初始间距
  ATTACK_RANGE: 250,       // 进入此距离才能出手
  APPROACH_SPEED: 320,     // 双方每秒相向靠拢的合计速度（px/s）
  PUNCH_DAMAGE: 10,        // 快拳基础伤害
  COMBO_BONUS: 3,          // 每层连击额外伤害
  COMBO_CAP: 8,            // 连击伤害加成封顶层数
  KICK_DAMAGE: 8,          // 扫腿伤害（低，但带击退重置距离）
  KICK_KNOCKBACK: 140,
  ATTACK_WINDOW: 1.0,      // 距上次出手 <1s 判定为快拳，否则为扫腿
  PUNCH_COOLDOWN: 0.32,    // 快拳后摇
  KICK_COOLDOWN: 0.5,      // 扫腿后摇
  BLOCK_REDUCE: 0.8,       // 格挡减免比例
  SUPER_DAMAGE: 36,
  SUPER_METER_MAX: 100,
  METER_PER_HIT: 20,       // 每次命中积攒的能量
  SUPER_LOCK: 0.55,        // 超必杀后摇
  ENEMY_WINDUP: 0.28,      // 敌方出手前摇（可读预警）
};

// 三个对手（三关），难度递进
export const LEVELS = [
  { enemyHp: 60,  enemyAttackInterval: 1.1,  enemyDamage: 14 },
  { enemyHp: 78,  enemyAttackInterval: 0.9,  enemyDamage: 16 },
  { enemyHp: 96,  enemyAttackInterval: 0.75, enemyDamage: 18 },
];

export const LEVEL_COUNT = LEVELS.length;

// 语言：默认英文；zh 必做。只暴露 locales 里真实存在的语言。
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'fighter-ko-arena-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'fighter-ko-arena-save',
};
