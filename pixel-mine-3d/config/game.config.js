// config/game.config.js — PIXEL MINE 3D 全部数值/关卡/文案 key（config-first）
// sim/render/ui 不写死数字；随机只走 seed（mulberry32，见 src/game/sim.js）。

export const STEP = 1 / 60;

export const WORLD = {
  W: 48, H: 64, D: 48,           // 世界尺寸（x 宽 / y 深 / z 深）；y=0 是地表，向下越深
  CHUNK: 16,                     // 渲染分块边长（3×4×3 = 36 chunk）
  SPAWN: [24, 0, 24],            // 出生点（feet 位置，y=0 地表）
  SELL: [24, 0, 20],             // 卖矿台（走上去自动结算）
  UPGRADE: [24, 0, 26],          // 升级站（Tab 打开）
  SELL_RADIUS: 2.4,
  REACH: 4.5,                    // 挖掘/放梯最大距离
  CRACK_STAGES: 3,
};

export const PLAYER = {
  EYE: 1.62, WIDTH: 0.6, HEIGHT: 1.8,
  SPEED: 5.2, ACCEL: 42, FRICTION: 11,
  GRAVITY: 24, JUMP: 8.6, CLIMB: 3.4,
  STAMINA: 100, STAMINA_REGEN: 12,      // 站立回复 / 秒
  MINE_STAMINA: 3,                      // 挖矿体力消耗 / 秒
  CLIMB_STAMINA: 6,
  HP: 100, LAVA_DPS: 30,
  FALL_DMG_Y: 7, FALL_DMG: 12,          // 坠落超过 7 格开始掉血
};

// 方块类型 id（世界 Uint8Array 里的值）
export const T = {
  AIR: 0, DIRT: 1, STONE: 2, COAL: 3, IRON: 4, GOLD: 5,
  DIAMOND: 6, BEDROCK: 7, LAVA: 8, LADDER: 9, TREASURE: 10,
};

// 每类方块的渲染/数值属性；value=卖出价，hardness=基础挖掘秒数，glow=自发光强度
export const BLOCKS = {
  [T.DIRT]:     { name: 'dirt',     value: 1,   hardness: 0.5, solid: true,  color: 0x7c5a3a, emissive: 0x000000, glow: 0 },
  [T.STONE]:    { name: 'stone',    value: 3,   hardness: 1.0, solid: true,  color: 0x4b5563, emissive: 0x000000, glow: 0 },
  [T.COAL]:     { name: 'coal',     value: 6,   hardness: 1.4, solid: true,  color: 0x111827, emissive: 0x1f2937, glow: 0.25 },
  [T.IRON]:     { name: 'iron',     value: 12,  hardness: 1.8, solid: true,  color: 0x9ca3af, emissive: 0x6b7280, glow: 0.3 },
  [T.GOLD]:     { name: 'gold',     value: 25,  hardness: 2.2, solid: true,  color: 0xfbbf24, emissive: 0xf59e0b, glow: 1.4 },
  [T.DIAMOND]:  { name: 'diamond',  value: 60,  hardness: 2.8, solid: true,  color: 0x34d399, emissive: 0x10b981, glow: 1.2 },
  [T.BEDROCK]:  { name: 'bedrock',  value: 0,   hardness: 4.0, solid: true,  color: 0x1f2430, emissive: 0x000000, glow: 0 },
  [T.LAVA]:     { name: 'lava',     value: 0,   hardness: 0,   solid: true,  color: 0xef4444, emissive: 0xf97316, glow: 1.6 },
  [T.LADDER]:   { name: 'ladder',   value: 0,   hardness: 0,   solid: false, color: 0xb45309, emissive: 0x000000, glow: 0 },
  [T.TREASURE]: { name: 'treasure', value: 250, hardness: 0.4, solid: true,  color: 0x67e8f9, emissive: 0x22d3ee, glow: 1.8 },
};

// 深度分层（by 从 0 向下）；level 用于 fun-report 的 levelsReached
export const LAYERS = [
  { maxDepth: 7,  base: T.DIRT,    level: 1 },
  { maxDepth: 15, base: T.STONE,   level: 2 },
  { maxDepth: 23, base: T.STONE,   level: 3 },
  { maxDepth: 31, base: T.STONE,   level: 3 },
  { maxDepth: 39, base: T.STONE,   level: 4 },
  { maxDepth: 47, base: T.STONE,   level: 4 },
  { maxDepth: 63, base: T.BEDROCK, level: 5 },
];

// 矿脉生成：band=[深min,max]；veins=簇数；seams=横向金脉条数
export const ORE_GEN = [
  { band: [16, 23], type: T.COAL, veins: 7, size: 6 },
  { band: [24, 31], type: T.IRON, veins: 6, size: 5 },
  { band: [32, 39], type: T.GOLD, seams: 3, seamLen: 12 },
  { band: [40, 47], type: T.DIAMOND, veins: 5, size: 4 },
  { band: [40, 47], type: T.LAVA, veins: 3, size: 6 },
];

// 宝藏房（终局）：基岩中空腔 + 上方软石裂缝 + 地板宝藏块
export const TREASURE = {
  room: { x0: 20, x1: 27, y0: 56, y1: 63, z0: 20, z1: 27 },
  crack: [24, 24],               // 出生点正下方（x,z），裂缝列 48..55 换成石头
};

export const UPGRADES = {
  pick:    { levels: 3, costs: [40, 90, 160], per: 0.6 },
  pack:    { levels: 3, costs: [30, 70, 120], per: 10 },
  stamina: { levels: 3, costs: [25, 60, 110], per: 40 },
  lamp:    { levels: 2, costs: [35, 80] },
  vein:    { cost: 60 },
  double:  { cost: 80 },
  smelt:   { cost: 50 },
  sort:    { cost: 50 },
  lava:    { cost: 90 },
};

export const GOAL = { type: 'depth', target: 24, reward: 120 };

export const FX = { hitstopMs: 40, shake: 0.05 };

export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'pixel-mine-3d-lang',
  langNames: { en: 'English', zh: '中文' },
  title: 'PIXEL MINE 3D',
};

// 触屏摇杆/按钮安全尺寸
export const TOUCH = { btn: 52, joy: 120 };
