// CAKE KART · 竞速数值配置（全部数值常量都在这，逻辑不写死数字）
// 契约：docs/analysis.md（事件名/字段一字不差）

export const STEP = 1 / 60;

// ---- 车手（玩家 + AI 共用基础）----
export const KART = {
  COUNT: 6,             // 玩家 + 5 AI
  START_LANE_SPACING: 14, // 起步横向间隔（世界单位）
  MAX_SPEED: 150,       // 满油门极限速度（wu/s）
  ACCEL: 60,            // 油门加速度（wu/s²）
  DRAG: 34,             // 松油门自然减速（wu/s²）
  BRAKE: 60,            // 反向油门减速（wu/s²）
  STEER_SPEED: 64,      // 正常转向横移速度（wu/s）
  DRIFT_STEER_SPEED: 88,// 漂移转向横移速度（wu/s）
  LANE_V_LERP: 8,       // 横向速度追踪系数（1/s）
  AUTO_THROTTLE: 0.5,   // 无障碍兜底油门：不按 ↑ 也缓慢前进（noinput 仍会冲出赛道）
  CENTRIFUGAL: 21,      // 离心外滑系数：弯道不反打会往外滑（noinput 撞栏的关键）
};

// ---- 糖霜漂移（三档：越满越快但越难控）----
export const DRIFT = {
  CHARGE_RATE: 0.55,    // 漂移蓄力速率（/s，0..1）
  DECAY_RATE: 0.9,      // 未漂移时蓄力回落（/s）
  TIERS: [0, 1 / 3, 2 / 3, 1], // 三档阈值
  DRAG_PER_CHARGE: 14,  // 漂移减速（随蓄力增大）
  SLIDE_PER_CHARGE: 26, // 出弯外滑（随蓄力增大，越满越难控）
  BOOST_SEC_PER_CHARGE: 2.0, // 松漂移 → 加速时长 = charge * 该值
  BOOST_MULT: 1.35,     // 加速倍率
  MIN_CHARGE_TO_BOOST: 0.12,
};

// ---- 道具 ----
export const ITEM = {
  PICKUP_COOLDOWN: 1.2, // 每个道具箱拾取冷却（s）
  BOX_INTERVAL: 520,    // 道具箱沿赛道间距（世界单位）
  TYPES: ['missile', 'shield', 'boost', 'cake'],
  MISSILE_SLOW: 0.25,   // 命中后速度比例
  MISSILE_SPIN_SEC: 1.6,
  SHIELD_SEC: 5,
  BOOST_SEC: 1.6,
  BOOST_MULT: 1.5,
  CAKE_BLIND_SEC: 2.0,
  CAKE_BLIND_STEER: 0.4, // 被糊住后 AI/玩家转向能力比例
};

// ---- 赛道 / 地形 ----
export const TRACK = {
  HALF_WIDTH: 46,       // 基础半宽（世界单位）
  BRIDGE_HALF_WIDTH: 24,// 窄桥半宽
  JELLY_BOOST_MULT: 1.4,// 果冻加速带速度倍率
  MUD_SLOW: 0.55,       // 巧克力泥减速区速度比例
  OFFROAD_SLOW: 0.5,    // 出赛道减速
  CRASH_LANE: 1.4,      // 冲出半宽的倍数 → 撞栏（crash）
  BARRIER_SPIN_SEC: 1.4,// 撞栏失控时长
};

// ---- AI ----
export const AI = {
  BASE_SPEED: 118,      // 第 1 站 AI 巡航速度
  SPEED_PER_STATION: 1.6, // 每站 +（上限见 MAX_SPEED）
  RACING_LINE: 0.12,    // 过弯走线偏内（半宽比例）
  DRIFT_CURV: 0.0015,   // 曲率超过此值 AI 提前漂移
  ITEM_USE_MIN_SEC: 4,  // AI 使用道具最小间隔
  ITEM_USE_CHANCE: 0.06,// 每 tick 使用概率
};

// ---- 遥测 / 里程碑 ----
export const TELEMETRY = {
  MILESTONE_M: 50,      // 每 50 世界单位发一次 milestone（保持事件密度）
};

// ---- 辅助纯函数 ----
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** 平滑接近（exp 追踪）：当前值向目标以 rate 的指数逼近 */
export function approach(cur, target, rate, dt) {
  return cur + (target - cur) * (1 - Math.exp(-rate * dt));
}
