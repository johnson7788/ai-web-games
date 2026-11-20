// OCEAN DASH · M1 数值配置（全部数值常量都在这，逻辑不写死数字）
// 契约：docs/README.md（事件名 / 字段一字不差）

// ---- 世界 / 坐标 ----
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  SURFACE_Y: 130,
  PLAYER_X: 300,
  BOTTOM_Y: 720,
  WATER_MIN: 168,    // 鱼能在水中到达的最高 y（头顶留一点水面）
  WATER_MAX: 660,    // 鱼能在水中到达的最低 y（离底留一点）
};

export const STEP = 1 / 60;

// ---- 玩家 / 鱼群 ----
export const PLAYER = {
  W: 44,             // 领头鱼碰撞盒宽
  H: 40,             // 领头鱼碰撞盒高（单条鱼的高度）
  START_FISH: 6,     // 开局鱼群数（含领头鱼 = 血量）
  MAX_FISH: 12,      // 鱼群上限
};

// ---- 鱼群散聚 ----
export const SCHOOL = {
  GATHER_H: 34,           // 收拢时碰撞盒总高（窄缝可过，留足容错）
  SPREAD_H_BASE: 64,      // 散开基础高度（> 窄缝 60，散开过不去）
  SPREAD_H_PER_FISH: 7,   // 每条鱼加高
  SPREAD_H_MAX: 176,      // 散开高度上限
  GATHER_SPEED_MULT: 0.8, // 收拢时前进速度倍率（慢）
  SPREAD_SPEED_MULT: 1.0, // 散开时前进速度倍率（快）
};

// ---- 前进 / 转向 ----
export const STEER = {
  KEY_SPEED: 300,      // 键盘上下速度（px/s）
  LERP: 10,            // 指针目标 y 缓动系数（1/s）
  MAX_VY: 480,         // 最大纵向速度
  TILT_PER_VY: 0.0016, // 倾角 = vy * 该系数
  MAX_TILT: 0.7,
  IDLE_SINK: 55,       // 无输入时缓慢下沉（保持「不游就沉」的节奏压力）
};

// ---- 障碍 ----
export const OBSTACLE = {
  REEF_W_MIN: 90,      // 礁石宽
  REEF_W_MAX: 150,
  JELLY_W: 56,
  JELLY_H: 46,
  ROOT_W_MIN: 44,
  ROOT_W_MAX: 74,
  HIT_FISH_LOSS: 2,    // 碰撞掉鱼（重创：礁石/水母/树根都伤筋动骨）
  HIT_SLOW_MULT: 0.35, // 碰撞后减速倍率
  HIT_SLOW_SEC: 0.9,   // 减速时长
  INVULN_SEC: 1.0,     // 碰撞后无敌
};

// ---- 气泡（加速 + 回鱼）----
export const BUBBLE = {
  R: 15,
  FISH_GAIN: 1,
  BOOST_MULT: 1.5,
  BOOST_SEC: 1.6,
};

// ---- 洋流带（signature：箭形光带加速）----
export const CURRENT = {
  W: 90,
  BOOST_MULT: 1.8,
  BOOST_SEC: 2.2,
  GAP: 780,           // 洋流带平均间距
};

// ---- 跃出 / 滑翔 ----
export const GLIDE = {
  JUMP_VY: -660,       // 起跳向上速度
  GRAVITY: 1500,       // 空中重力
  GLIDE_SPEED_MULT: 1.6, // 滑翔前进速度倍率
  GLIDE_FALL: 70,      // 滑翔时缓慢下落速度
  EXIT_ABOVE: 26,      // 高出水面多少 px 视为可滑翔
};

// ---- 逆流区（赛段 5 等）----
export const COUNTER = {
  SLOW_MULT: 0.7,
};

// ---- nearMiss ----
export const NEAR_MISS = {
  GAP: 26,            // 纵向擦肩 <26px 判定
  THROTTLE: 1.2,
};

// ---- 里程碑（事件密度）----
export const MILESTONE = {
  PX: 90,             // 每前进 90px 发一个里程碑事件
};

// ---- 竞速 AI ----
export const AI = {
  COUNT: 3,
  SPEED_MIN: 0.88,    // 相对玩家 baseSpeed 的最低倍率
  SPEED_MAX: 1.04,    // 最高倍率
  RUBBER_GAIN: 0.07,  // 落后玩家时加速
  RUBBER_LOSE: 0.06,  // 领先玩家时减速
  LOOKAHEAD: 300,     // AI 预判障碍距离
  HIT_SLOW_MULT: 0.55,
  HIT_SLOW_SEC: 0.6,
};

// ============================================================
// 纯函数（无副作用，供 sim 复用）
// ============================================================

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// 鱼群散开高度：散开时随鱼数变高（更易撞），收拢时固定窄
export function schoolHeight(fish, gathered) {
  if (gathered) return SCHOOL.GATHER_H;
  return clamp(SCHOOL.SPREAD_H_BASE + fish * SCHOOL.SPREAD_H_PER_FISH, SCHOOL.GATHER_H, SCHOOL.SPREAD_H_MAX);
}

// 前进速度倍率（散聚/加速/减速/逆流/滑翔 全部乘上去）
export function speedMult(state) {
  let m = state.gathered ? SCHOOL.GATHER_SPEED_MULT : SCHOOL.SPREAD_SPEED_MULT;
  if (state.boostT > 0) m *= state.boostMult;
  if (state.slowT > 0) m *= OBSTACLE.HIT_SLOW_MULT;
  if (state.counter) m *= COUNTER.SLOW_MULT;
  if (state.gliding) m *= GLIDE.GLIDE_SPEED_MULT;
  return m;
}
