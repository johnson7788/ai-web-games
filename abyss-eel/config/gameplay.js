// ABYSS EEL · M1 数值配置（全部数值常量都在这，逻辑不写死数字）
// 契约：docs/abyss-eel/README.md（事件名/字段一字不差）

// ---- 世界 / 坐标 ----
export const WORLD = {
  WIDTH: 1280, // 逻辑世界宽（px）
  HEIGHT: 720, // 逻辑世界高（px）
  HEAD_Y: 540, // 鳗头屏幕 y（固定）
  PX_PER_METER: 10, // depth（米）= 累计滚动像素 / 10
};

export const STEP = 1 / 60; // 固定步长（秒）

export const HEAD = {
  W: 48, // 头部碰撞盒宽（px）
  H: 40, // 头部碰撞盒高（px）
  START_X: 640, // 开局头中心 x
};

// ---- 光珠 ----
export const ORBS = {
  START: 10, // 开局珠数（= 血量 = 链长）
  MAX: 99, // 珠上限
  TRAIL_SPACING: 34, // 轨迹每 34px 放一珠（原作手感）
};

// ---- 滚动 / 深度 ----
export const SCROLL = {
  DASH_MULT: 1.8, // 冲刺时滚动速度倍率
};

// ---- 数字墙 ----
export const WALL = {
  BASE: 1, // 墙值公式基数：1 + floor(depth/120) + rand(0..depth/180)
  DEPTH_DIV: 120,
  RAND_DIV: 180,
  MIN: 1,
  MAX: 60, // clamp 1..60
  H: 44, // 墙高（px）
  W_MIN: 120, // 墙宽范围（px）
  W_MAX: 220,
  MOVE_SPEED: 90, // 移动墙横移速度（px/s，zone2+）
};

// ---- 连击 ----
export const COMBO = {
  WINDOW: 2.5, // 破墙后 2.5s 内再破墙 +1
  MULT_PER: 0.1, // 乘数 = 1 + combo*0.1
  MULT_CAP: 3.0, // cap ×3
};

// ---- 光半径 ----
export const LIGHT = {
  BASE: 160, // 160 + orbs*14
  PER_ORB: 14,
  MIN: 160,
  MAX: 900, // clamp 160..900
  FULL: 900, // 前两带全亮（zone<3）
  ACTIVE_ZONE: 3, // zone>=3 光半径才生效
};

// ---- 冲刺 ----
export const DASH = {
  BURN_PER_SEC: 2, // 持续燃烧 2 珠/s
  MIN_ORBS: 5, // 至少 5 珠才能启动
  DAMAGE_MULT: 2, // 撞墙伤害 ×2
  UNLOCK_ZONE: 2, // zone2 起解锁
  HEAT_RATE: 6, // dashHeat 上升/回落速率（1/s，视觉强度 0..1）
};

// ---- 海胆 ----
export const URCHIN = {
  VALUE: 999, // 海胆 value=999（不可击穿）
  CUT: 5, // 断尾 5 珠
  CUT_TAILGUARD: 1, // tailGuard 升级则只断 1
  INVULN: 0.8, // 碰后无敌 0.8s
  UNLOCK_ZONE: 4, // zone4+ 出现
  W: 44, // 海胆宽（px）
  H: 44, // 海胆高（px）
};

// ---- Boss ----
export const BOSS = {
  FIRST_DEPTH: 2100, // 首个 Boss 深度（m）
  INTERVAL: 900, // 之后每 900m 循环出现一次
  SEGMENTS: 5, // 宽 1280 分 5 段
  VALUE_MULT: 8, // 每段 value = 当前带墙值 ×8
  REGEN_SEC: 6, // 被击穿段 6s 后再生
  H: 120, // Boss 墙高（px）
  APPROACH: 600, // 提前多少 px 生成（让 Boss 墙从前方滚入，而非瞬移贴脸）
};

// ---- 火花 ----
export const SPARK = {
  COUNT_MIN: 3, // 破墙生成 3–6 个 spark
  COUNT_MAX: 6,
  LIFE: 1.0, // 1s 内被真空吸回首部
  VACUUM: 2600, // 真空吸回加速度（px/s²，随生命衰减增强）
  PICKUP: 28, // 吸回判定半径（px）
};

// ---- 食物 ----
export const FOOD = {
  PICKUP: 36, // 拾取判定半径（px）
};

// ---- nearMiss ----
export const NEAR_MISS = {
  GAP: 24, // 水平擦肩 <24px 且未相交
  THROTTLE: 2.0, // 节流 2s 一次
};

// ---- 转向 ----
export const STEER = {
  LERP: 14, // 缓动追踪系数（1/s）：vx = (target-x)*LERP，上限见 MAX_VX
  MAX_VX: 1100, // 最大横移速度（px/s）
  TILT_PER_VX: 0.0006, // 头部倾斜角 = vx * 该系数
  MAX_TILT: 0.7, // 最大倾斜角（rad）
};

// ---- 生成 ----
export const SPAWN = {
  LOOKAHEAD: 900, // 前方预生成距离（px）
  GAP: 220, // 相邻波次间距（px）——更密的墙流：每 1–1.5s 一个决定
};

// ---- 轨迹缓冲 ----
export const TRAIL = {
  KEEP: 64, // 轨迹多保留的额外点数（超过 hp 的部分用于缓冲）
};

// ============================================================
// 纯函数（无副作用，供 sim/spawner 复用；数字全部来自上面的常量）
// ============================================================

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// 墙值：1 + floor(depth/120) + rand(0..depth/180)，clamp 1..60
export function wallValueAt(depth, rng) {
  const d = Math.max(0, Math.floor(depth));
  const randTop = Math.floor(d / WALL.RAND_DIV);
  const v = WALL.BASE + Math.floor(d / WALL.DEPTH_DIV) + Math.floor(rng() * (randTop + 1));
  return clamp(v, WALL.MIN, WALL.MAX);
}

// 连击乘数 = 1 + combo*0.1（cap ×3）
export function comboMult(combo) {
  return Math.min(COMBO.MULT_CAP, 1 + combo * COMBO.MULT_PER);
}

// 光半径：zone>=3 才生效，前两带全亮
export function lightRadiusAt(zone, orbs) {
  if (zone < LIGHT.ACTIVE_ZONE) return LIGHT.FULL;
  return clamp(LIGHT.BASE + orbs * LIGHT.PER_ORB, LIGHT.MIN, LIGHT.MAX);
}
