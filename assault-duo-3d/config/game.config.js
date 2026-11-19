// ASSAULT DUO 3D · 全局数值与配置（纯数据，可被 node --test / selfplay 直接 import）
// 玩法：横版霓虹双人突击。玩家 NOVA + AI 搭档 JET 在霓虹城顶扫清成波无人机。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_Y: 600,
  GRAVITY: 1900,
  LEFT_WALL: 26,
  RIGHT_WALL: 1254,
};

export const STEP = 1 / 60;

export const PLAYER = {
  WIDTH: 46,
  HEIGHT: 58,
  SPEED: 330,
  JUMP_V: 660,
  MAX_HP: 100,
  FIRE_RANGE: 760,
  INVULN: 0.4, // 受伤后无敌秒数
};

export const COMPANION = {
  WIDTH: 34,
  HEIGHT: 44,
  OFFSET_X: -56, // 相对玩家 x
  HOVER_Y: -64, // 相对玩家 y（悬浮）
  DAMAGE: 8,
  COOLDOWN: 0.5,
  BULLET_SPEED: 820,
  RANGE: 780,
};

// 武器：0 手枪 / 1 散射 / 2 电浆穿透 / 3 火箭范围
export const WEAPONS = [
  { id: 0, key: 'pulse',    label: 'PULSE PISTOL',    damage: 12, cooldown: 0.22, speed: 940,  range: 760, pellets: 1, spread: 0,    pierce: 0, radius: 0 },
  { id: 1, key: 'scatter',  label: 'SCATTER BLASTER', damage: 9,  cooldown: 0.55, speed: 840,  range: 640, pellets: 3, spread: 0.22, pierce: 0, radius: 0 },
  { id: 2, key: 'volt',     label: 'VOLT CANNON',     damage: 20, cooldown: 0.40, speed: 1500, range: 800, pellets: 1, spread: 0,    pierce: 3, radius: 0 },
  { id: 3, key: 'rocket',   label: 'ROCKET POD',      damage: 55, cooldown: 0.90, speed: 540,  range: 900, pellets: 1, spread: 0,    pierce: 0, radius: 96 },
];

// 敌人类型：近战（melee）与远程（ranged）
export const ENEMY_TYPES = {
  drone:   { hp: 24,  attack: 6,  speed: 76,  meleeRange: 46, attackCd: 1.0, ranged: false, range: 0,   bulletSpeed: 0,   radius: 20, score: 10,  shield: false, boss: false },
  striker: { hp: 16,  attack: 5,  speed: 132, meleeRange: 40, attackCd: 0.8, ranged: false, range: 0,   bulletSpeed: 0,   radius: 16, score: 15,  shield: false, boss: false },
  gunner:  { hp: 42,  attack: 9,  speed: 54,  meleeRange: 0,  attackCd: 1.7, ranged: true,  range: 430, bulletSpeed: 390, radius: 22, score: 25,  shield: false, boss: false },
  shield:  { hp: 96,  attack: 12, speed: 42,  meleeRange: 50, attackCd: 1.2, ranged: false, range: 0,   bulletSpeed: 0,   radius: 28, score: 40,  shield: true,  boss: false },
  boss:    { hp: 420, attack: 20, speed: 48,  meleeRange: 62, attackCd: 1.1, ranged: true,  range: 470, bulletSpeed: 400, radius: 44, score: 200, shield: false, boss: true },
};

// 关卡：waves 里 t = 距本关开始的秒数，enemies = 敌方类型名
export const LEVELS = [
  {
    index: 1,
    nameKey: 'level1',
    waves: [
      { t: 0.6, x: 880, enemies: ['drone', 'drone', 'drone'] },
      { t: 2.6, x: 980, enemies: ['drone', 'drone', 'drone'] },
      { t: 4.6, x: 940, enemies: ['drone', 'striker', 'drone'] },
    ],
  },
  {
    index: 2,
    nameKey: 'level2',
    waves: [
      { t: 0.6, x: 880, enemies: ['drone', 'striker', 'drone'] },
      { t: 2.6, x: 990, enemies: ['striker', 'striker', 'drone'] },
      { t: 4.6, x: 940, enemies: ['drone', 'gunner', 'drone'] },
      { t: 6.6, x: 1000, enemies: ['striker', 'drone', 'striker'] },
    ],
  },
  {
    index: 3,
    nameKey: 'level3',
    waves: [
      { t: 0.6, x: 900, enemies: ['drone', 'gunner', 'drone'] },
      { t: 2.6, x: 1000, enemies: ['striker', 'gunner', 'striker'] },
      { t: 4.6, x: 960, enemies: ['gunner', 'drone', 'striker'] },
      { t: 6.8, x: 1020, enemies: ['gunner', 'striker', 'gunner'] },
    ],
  },
  {
    index: 4,
    nameKey: 'level4',
    waves: [
      { t: 0.6, x: 900, enemies: ['shield', 'drone', 'drone'] },
      { t: 2.6, x: 1000, enemies: ['striker', 'shield', 'gunner'] },
      { t: 4.6, x: 960, enemies: ['shield', 'gunner', 'striker'] },
      { t: 6.8, x: 1020, enemies: ['gunner', 'shield', 'drone'] },
    ],
  },
  {
    index: 5,
    nameKey: 'level5',
    waves: [
      { t: 0.6, x: 900, enemies: ['shield', 'gunner'] },
      { t: 3.0, x: 980, enemies: ['striker', 'striker', 'drone'] },
      { t: 5.4, x: 1000, enemies: ['gunner', 'shield'] },
      { t: 8.0, x: 900, enemies: ['boss'] },
    ],
  },
];

// 连击 / DUO 能量 / 道具
export const COMBO = {
  WINDOW: 2.2, // 连击窗口秒
  STEP: 5, // 每 5 连击升一档
  MAX: 30,
  DAMAGE_BONUS: 0.05, // 每档 +5% 伤害
};

export const DUO = {
  METER_MAX: 100,
  PICKUP_GAIN: 16, // 能量球 +16
  KILL_GAIN: 6, // 每次击杀 +6
  BLAST_DAMAGE: 40,
  BLAST_RADIUS: 460,
};

export const PICKUP = {
  RADIUS: 12,
  DROP_CHANCE: 0.55,
  LIFETIME: 8,
};

// 语言 / 存档（i18n-check 会静态读这个文件）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'assault-duo-3d-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'assault-duo-3d-save',
};
