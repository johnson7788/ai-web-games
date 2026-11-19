// ARCHER MISS 3D · 全局数值与运行时配置
// 纯数据，无 DOM。sim / render / ui / main / tools 都从这里读。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  ARENA_R: 10,          // 竞技场半径（世界单位）
  PLAYER_R: 0.55,       // 玩家碰撞半径
  MONSTER_R: 0.6,       // 怪物碰撞半径
  ROCK_R: 0.9,          // 岩石碰撞半径
};

export const STEP = 1 / 60;

// 核心手感/平衡（世界单位 / 秒）
export const BALANCE = {
  player: {
    hp: 120,
    attack: 30,
    attackInterval: 0.7,    // 每次射击间隔（秒）
    moveSpeed: 6.0,
    critRate: 0.1,
    critDamage: 1.6,
    dodge: 0.05,
  },
  arrow: {
    speed: 34,
    life: 0.9,             // 最大飞行秒数
    radius: 0.22,
  },
  monster: {
    shard: { hp: 60, attack: 12, attackInterval: 1.1, moveSpeed: 3.2, range: 1.3 },
    caster: { hp: 48, attack: 10, attackInterval: 1.6, moveSpeed: 2.4, range: 6.5 },
  },
  projectile: {
    speed: 11,
    radius: 0.34,
    warningSec: 0.9,
  },
  powerup: {
    radius: 0.45,
    rapidDuration: 5.0,
    rapidAttackInterval: 0.3,
  },
  comboWindow: 3.0,       // 连击无刷新则归零
  levelCount: 4,          // 总关卡数
};

// 升级池：kind 'rule' 改规则 / 'stat' 改数值；≥35% 必须 rule
export const UPGRADES = [
  { id: 'double',   kind: 'rule', name: 'double',      weight: 1 },
  { id: 'pierce',   kind: 'rule', name: 'pierce',      weight: 1 },
  { id: 'ice',      kind: 'rule', name: 'ice',         weight: 1 },
  { id: 'fire',     kind: 'rule', name: 'fire',        weight: 1 },
  { id: 'lightning', kind: 'rule', name: 'lightning',  weight: 1 },
  { id: 'rapid',    kind: 'rule', name: 'rapid',       weight: 1 },
  { id: 'atk',      kind: 'stat', name: 'atk',         weight: 1 },
  { id: 'spd',      kind: 'stat', name: 'spd',         weight: 1 },
  { id: 'hp',       kind: 'stat', name: 'hp',          weight: 1 },
  { id: 'crit',     kind: 'stat', name: 'crit',        weight: 1 },
];

// 关卡定义（0 基）。rocks 数量随关卡递增；casters 从第 2 关开始出现。
export function levelDef(levelIndex) {
  const lv = levelIndex + 1;
  const def = {
    shards: Math.min(3 + levelIndex, 6),
    casters: levelIndex >= 1 ? Math.min(1 + Math.floor(levelIndex / 2), 3) : 0,
    rocks: 2 + levelIndex,
    hpMul: 1 + (levelIndex) * 0.35,
    atkMul: 1 + (levelIndex) * 0.25,
    spdMul: 1 + (levelIndex) * 0.08,
  };
  return def;
}

// 语言：默认英文；zh 必做（i18n-check 只要求 en+zh 完整）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'archer-miss-3d-lang',
  langNames: {
    en: 'English',
    zh: '中文',
  },
  saveKey: 'archer-miss-3d-save',
};
