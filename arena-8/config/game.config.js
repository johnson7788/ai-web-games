// config/game.config.js — 所有数值集中，逻辑层只读不写死（config-first）。
export const STEP = 1 / 60;
export const VIEW = { W: 1280, H: 720 };

export const CONFIG = {
  appId: 'arena-8',
  title: 'ARENA 8',
  defaultLang: 'en',
  languages: ['en', 'zh'],
  langNames: { en: 'English', zh: '中文' },
  rtlLangs: ['ar'],
  langStorageKey: 'arena-8:lang',
  saveKey: 'arena-8:save',
  logicFps: 60,
};

// 圆形竞技场：边缘无墙，可扔出场外
export const ARENA = {
  R: 26,            // 场地半径（单位）
  FALL_MARGIN: 1.2, // 瘫软/腾空者越过 R+MARGIN 即判出场
  shrink: { enabled: true, to: 14, atSec: 60 }, // 决胜圈（第 5 场启用）
};

export const FIGHTER = {
  hp: 100,
  speed: 7.5,
  accel: 40,
  friction: 9,
  radius: 0.72,
  carrySpeedMul: 0.5,   // 抓举时移速减半
  lifesteal: 15,        // 玩家每淘汰一名对手回复的生命
  punch: { dmg: 20, range: 2.0, arc: 1.25, cd: 0.42, knockback: 5.5, ragdoll: 0.8 },
  grab: { range: 1.6 },
  throw: { power: 22, up: 4 },
  ult: { dmg: 22, range: 6.5, knockback: 12, cd: 12 },
};

export const WEAPONS = {
  durability: 10,
  spawn: { count: 3, respawnT: 6 },
  // 球棒=伤害×2 / 平底锅=击退×2 / 拳套=攻速×1.5
  defs: {
    bat:   { dmgMul: 2.0, knockMul: 1.0, speedMul: 1.0 },
    pan:   { dmgMul: 1.0, knockMul: 2.0, speedMul: 1.0 },
    glove: { dmgMul: 1.0, knockMul: 1.0, speedMul: 1.5 },
  },
};

export const MATCH = {
  rounds: 5,        // 5 场锦标赛
  time: 180,        // 每局 3 分钟
  fighters: 8,      // 1 玩家 + 7 bot
  spawnR: 0.8,      // 出生环半径比例（相对 ARENA.R）
};

export const BOT = {
  baseSpeed: 6.0,
  speedPerRound: 0.30,   // 难度随场次上升
  dmgBase: 0.32,         // bot 打玩家的伤害随场次上升（第 1 场较弱）
  dmgPerRound: 0.06,
  aggroBase: 0.40,
  aggroPerRound: 0.10,
  reactionBase: 0.35,
  reactionPerRound: -0.05,
  fleeHp: 20,            // 残血逃跑阈值
  edgeAvoid: 2.6,
  punchRange: FIGHTER.punch.range,
  grabRange: FIGHTER.grab.range,
};

export const SCORE = {
  kill: 100,
  fall: 150,
  survive: 20,       // 每场存活奖励
  winMatch: 250,
  ratings: [['S', 1200], ['A', 750], ['B', 400], ['C', 0]],
};

export const CAMERA = {
  dist: 13, height: 8.5, lookAhead: 3, smooth: 5,
  fov: 58,
};

// 8 角色糖果色（玩家=index 0）
export const COLORS = [
  0xff4d6d, 0xff9f1c, 0xffd23f, 0x70e000,
  0x38e8d8, 0x4d7cff, 0xff6ad5, 0xb388eb,
];

export const FLOOR = 0x1f2937;
export const ARENA_COLOR = 0x7c3aed;

// 升级：5 规则 + 3 数值（场间三选一）
export const UPGRADES = [
  { id: 'grab-range',    kind: 'rule' },
  { id: 'throw-power',   kind: 'rule' },
  { id: 'shockwave',     kind: 'rule' },
  { id: 'weapon-master', kind: 'rule' },
  { id: 'counter-punch', kind: 'rule' },
  { id: 'hp10',          kind: 'stat' },
  { id: 'move-speed',    kind: 'stat' },
  { id: 'punch-dmg',     kind: 'stat' },
];
