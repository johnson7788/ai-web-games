// config/gameplay.js — 玩法数值（Lead 所有）。逻辑层不写死数字，全部从这里读。
// 世界观：蒸汽朋克要塞。战场 26×26 半格（BLOCK=8 世界单位），坦克=装甲机甲（16 单位=2×2 格）。

export const MAP = {
  BLOCK: 8,          // 半格边长（世界单位）
  COLS: 26,
  ROWS: 26,
  W: 208,            // 26 * 8
  H: 208,
};

export const CELL = {
  EMPTY: 0,
  BRICK: 1,
  STEEL: 2,
  WATER: 3,
  GRASS: 4,
  FURNACE: 5,
};

// 方向（与原始 Dir 枚举一致）：0=左 1=上 2=右 3=下
export const DIR = { LEFT: 0, UP: 1, RIGHT: 2, DOWN: 3 };
export const DIR_VEC = {
  [DIR.LEFT]: { x: -1, y: 0 },
  [DIR.UP]: { x: 0, y: 1 },
  [DIR.RIGHT]: { x: 1, y: 0 },
  [DIR.DOWN]: { x: 0, y: -1 },
};

export const PLAYER = {
  SIZE: 16,
  BASE_SPEED: 40,          // 世界单位/秒（火力 0）
  SPEED_PER_LEVEL: 4,      // 每级火力 +4 单位/秒（还原 0.1*40）
  LIVES: 3,
  RESPAWN_DELAY: 0.9,      // 秒
  INVULN_AFTER_SPAWN: 3,   // 秒
  FIRE_COOLDOWN: 0.28,     // 秒（主炮）
  SPAWN: { x: 80, y: 8 },  // 出生点（熔炉左下方，col 10 / row 1）
};

// 火力等级表（星形道具/波间强化 +1）：并发弹数 & 弹速 step（速度=step*SPEED_MULT）
export const FIREPOWER = [
  { bullets: 1, step: 2 },  // L0：1 发
  { bullets: 2, step: 3 },  // L1：2 发（默认起始）
  { bullets: 2, step: 4 },  // L2：2 发，更快
  { bullets: 3, step: 5 },  // L3：3 发
];
export const MAX_FIREPOWER = FIREPOWER.length - 1;

export const BULLET = {
  SIZE: 4,
  SPEED_MULT: 62,          // step * 62 = 世界单位/秒
};

// 重炮弹（signature 弹药经济）：主炮无限但破钢墙只能靠它；每波补给 2 发。
export const HEAVY = {
  PER_WAVE: 2,
  MAX: 4,
  COOLDOWN: 0.9,           // 秒
  STEP: 5,                 // 250 单位/秒
  DAMAGE: 3,               // 可一击击杀重甲
  BREAKS_STEEL: true,
  BREAKS_BRICK: true,
};

// 焊修：每关 1 次，修复熔炉砖墙；代价=该波敌人提速。
export const REPAIR = {
  PER_WAVE: 1,
  SPEED_MULT: 1.35,        // 焊修后本波敌人速度 ×1.35
  FENCE_HEAL: true,
};

export const ENEMY_TYPES = {
  normal: { hp: 1, speed: 36, score: 100, labelKey: 'enemy.normal' },
  fast:   { hp: 1, speed: 58, score: 150, labelKey: 'enemy.fast' },
  armored:{ hp: 3, speed: 28, score: 300, labelKey: 'enemy.armored' },
  prop:   { hp: 1, speed: 36, score: 200, dropsProp: true, labelKey: 'enemy.prop' },
};

// 敌人生成点（顶部三处，还原 ENEMY1/2/3）
export const ENEMY_SPAWNS = [
  { x: 8, y: 200 },
  { x: 104, y: 200 },
  { x: 200, y: 200 },
];

// 熔炉（原「老鹰」→ 核心熔炉）：2×2 格，底部中央。
export const FURNACE = {
  HP: 8,
  X: 96,                 // col 12
  Y: 0,                  // row 0
  W: 16,                 // 2 格
  H: 16,
  FENCE: [               // 砖墙围栏（焊修目标）
    { row: 0, col: 11 }, { row: 1, col: 11 }, { row: 2, col: 11 },
    { row: 2, col: 12 }, { row: 2, col: 13 },
    { row: 0, col: 14 }, { row: 1, col: 14 }, { row: 2, col: 14 },
  ],
};

export const PROP = {
  LIFETIME: 10,          // 秒
  EFFECTS: ['star', 'bomb', 'fence', 'clock'],
  STAR_LEVELS: 1,        // 星形=火力 +1
  CLOCK_SEC: 8,          // 时钟静止秒数
  BOMB_KILLS_ALL: true,  // 炸弹清屏敌人
};

// 波间二选一强化（火力/速度/护甲/弹药+）
export const UPGRADES = {
  firepower: { key: 'up.firepower', kind: 'rule', max: MAX_FIREPOWER, apply: (run) => { run.firepower = Math.min(MAX_FIREPOWER, run.firepower + 1); } },
  speed:     { key: 'up.speed',     kind: 'stat', apply: (run) => { run.playerSpeedMul = (run.playerSpeedMul || 1) * 1.12; } },
  armor:     { key: 'up.armor',     kind: 'rule', max: 5, apply: (run) => { run.furnaceMaxHp = Math.min(5, run.furnaceMaxHp + 1); run.furnaceHp = run.furnaceMaxHp; } },
  ammo:      { key: 'up.ammo',      kind: 'rule', apply: (run) => { run.heavyPerWave = (run.heavyPerWave || HEAVY.PER_WAVE) + 1; } },
};

export const SCORE = {
  KILL: 'kill',         // 分数来源类型占位（见 levels.js 的 enemy.score）
};

// 敌方弹幕与战斗节奏
export const COMBAT = {
  ENEMY_BULLET_CAP: 12,  // 全场敌方子弹上限
  ENEMY_BULLET_STEP: 2,  // 敌弹速度 step（×50 = 100 单位/秒）
  ENEMY_FIRE_CHANCE: 0.4,
  ENEMY_SHOOT_CD_MIN: 1.2,
  ENEMY_SHOOT_CD_VAR: 1.6,
  ENEMY_SPAWN_STAR: 0.6,  // 出生无敌（星形动画）秒数
};

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
