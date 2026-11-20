// HOLE MUNCH · M1 数值配置（全部数值常量都在这，逻辑不写死数字）
// 契约：docs/analysis.md 的「改造映射」表；事件名见 sim.js 顶部注释。

// ---- 世界 ----
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  MARGIN: 72, // 洞口中心离边界的最小距离（px）；给上下 HUD 底条留出安全区，避免遮挡玩法主体
};

export const STEP = 1 / 60;

// ---- 黑洞 ----
export const HOLE = {
  BASE_R: 26,          // 初始半径（px），mass=0 时
  MIN_R: 24,           // 被吞重生后的最小半径
  MAX_R: 150,          // 半径上限
  R_PER_MASS: 0.55,    // r = BASE_R + sqrt(mass) * R_PER_MASS
  START_MASS: 0,
  PLAYER_HEAD_START: 8,  // 玩家每场开局比 AI 略大（英雄优势 + 成长感）
  EAT_RATIO: 1.06,     // 大洞半径 > 小洞半径 * EAT_RATIO 才可吞洞（≈质量多 12%）
  RESPAWN_KEEP: 0.4,   // 被吞重生保留的原质量比例（upgrade respawn-keep 可提高）
  PLAYER_HUNT_RATIO: 1.45, // AI 半径 > 玩家半径 * 该值，才主动追猎玩家（小洞是猎物）
  PLAYER_HUNT_RANGE: 5.5,  // 追猎触发距离 = ai.r * 该值
  PLAYER_HUNT_LOCK: 4,     // 追猎锁定秒数
};

// ---- 移动 ----
export const MOVE = {
  LERP: 10,            // 目标追踪系数（1/s）
  BASE_SPEED: 420,     // 满速 px/s（r=BASE_R 时）
  MIN_SPEED: 150,      // 最大体型的最低速度
  SPEED_FALLOFF: 0.004, // 每 (r-BASE_R) 速度衰减系数
  AI_LERP: 8,          // AI 追踪系数
  PLAYER_SPEED_MULT: 1.06, // 玩家英雄优势：同样体型比 AI 略快
  AI_SPEED_FALLOFF: 0.12,  // AI 速度随强度惩罚（强度越高越慢，玩家靠升级反超）
  HUNT_SPEED_BOOST: 1.5,   // 锁定猎物后的追击加速（捕食者快于玩家，才能真正抓到）
};

// ---- 吸入 / 吞并 ----
export const SUCK = {
  OUTER_K: 0.55,       // 外圈（开始吸入）= r + obj.r * OUTER_K
  CORE_K: 0.62,        // 内圈（吞并判定）= r * CORE_K
  TIME: 0.6,           // 从被吸入到被吞并的时长（秒）
  SPIN: 9,             // 吸入螺旋角速度（rad/s）
};

// ---- 物体等级（可吞物）----
// meteor 的实际成长倍数由 run.mods.meteorMult 决定（默认 3，吞噬竞速三倍成长）
export const OBJECTS = {
  lamp:       { r: 7,  mass: 1 },
  car:        { r: 11, mass: 3 },
  bus:        { r: 17, mass: 8 },
  building:   { r: 26, mass: 20 },
  skyscraper: { r: 36, mass: 50 },
  meteor:     { r: 13, mass: 15 },
};

// 每场可吞物的最大/最小半径范围（用于「比洞小」的吞食上限判断）
export const OBJECT_KINDS = Object.keys(OBJECTS);

// ---- 引力连锁 ----
export const CHAIN = {
  WINDOW: 3,           // 3s 内
  COUNT: 10,           // 连续吞 10 物
  AREA: 200,           // 同区域半径（px）
  BONUS: 0.3,          // 引力井扩大 30%
  DURATION: 5,         // 持续 5s
};

// ---- 吞噬竞速（陨石雨）----
export const METEOR = {
  INTERVAL: 30,        // 每 30s 一次
  COUNT: 12,           // 每波 12 颗
};

// ---- 比赛 ----
export const MATCH = {
  DURATION: 120,       // 单场 2 分钟
  AI_COUNT: 5,         // 5 个 AI 对手
  RANK_TO_ADVANCE: 3,  // 名次 ≤3 即算推进
  TOTAL_MATCHES: 12,   // 12 场推进结构
};

// ---- 大洞吞小洞 / 玩家被吞 ----
export const ELIMINATE = {
  DRAIN: 0,            // 0 = 立即吞并（不 drain）
  RESPAWN_INVULN: 2.5, // 重生无敌窗口（秒）
};

// ---- 升级 ----
export const UPGRADES = [
  { id: 'gravity-radius', kind: 'rule', label: 'up.gravityRadius', value: 0.25 },   // 吸入半径 +25%
  { id: 'devour-speed',   kind: 'rule', label: 'up.devourSpeed',   value: -0.3 },    // 吞并时长 -30%
  { id: 'chain-lower',    kind: 'rule', label: 'up.chainLower',    value: -3 },      // 连锁触发数 -3
  { id: 'chain-bonus',    kind: 'rule', label: 'up.chainBonus',    value: 0.2 },     // 连锁加成 +20%
  { id: 'meteor-boost',   kind: 'rule', label: 'up.meteorBoost',   value: 2 },       // 陨石成长 3x -> 5x
  { id: 'chain-duration', kind: 'rule', label: 'up.chainDuration', value: 2 },       // 引力井持续 +2s
  { id: 'move-speed',     kind: 'stat', label: 'up.moveSpeed',     value: 0.12 },    // 移速 +12%
  { id: 'start-mass',     kind: 'stat', label: 'up.startMass',     value: 30 },      // 开局质量 +30
  { id: 'max-radius',     kind: 'stat', label: 'up.maxRadius',     value: 25 },      // 最大半径 +25
  { id: 'hunt-double',    kind: 'rule', label: 'up.huntDouble',    value: 1 },       // 吞洞获得双倍质量
];

// ---- 遥测里程碑（保证反馈密度）----
export const FEEDBACK = {
  MOVE_STEP: 80,        // 每移动 80px 发 moveMilestone
  RANK_TICK: 1.0,       // 每 1s 发 rankTick（名次/得分反馈）
};

// ============================================================
// 纯函数（无副作用，供 sim 复用；数字全部来自上面的常量）
// ============================================================

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// 半径 = BASE_R + sqrt(mass) * R_PER_MASS，clamp MIN_R..MAX_R
export function radiusAt(mass, maxR = HOLE.MAX_R) {
  return clamp(HOLE.BASE_R + Math.sqrt(Math.max(0, mass)) * HOLE.R_PER_MASS, HOLE.MIN_R, maxR);
}

// 移动速度随体型衰减
export function moveSpeedAt(r) {
  const s = MOVE.BASE_SPEED / (1 + Math.max(0, r - HOLE.BASE_R) * MOVE.SPEED_FALLOFF);
  return Math.max(MOVE.MIN_SPEED, s);
}
