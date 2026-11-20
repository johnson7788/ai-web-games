// config/gameplay.js — SKY DROP DODGE · 玩法数值（所有数字都在这里，逻辑不写死数字）
// 事件契约与 wave 定义见 config/levels.js 与 docs/analysis.md。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  GROUND_Y: 640, // 玩家身体底部（地面）
  SPAWN_MARGIN: 40, // 掉落物生成 x 边距
  TOP_Y: -80, // 掉落物出生点（屏幕上方外）
};

export const STEP = 1 / 60;

// ---- 玩家 ----
export const PLAYER = {
  W: 46, // 身体碰撞盒宽
  H: 58, // 身体碰撞盒高（GROUND_Y-H .. GROUND_Y）
  START_X: 640,
  LERP: 14, // 缓动追踪系数：vx = (target - x)*LERP
  MAX_VX: 720, // 玩家自身最大横移速度（px/s）
  UMBRELLA_W: 150, // 伞面格挡宽度
  UMBRELLA_TOP: 556, // 伞面格挡盒顶部 y
};

// ---- 生命 / 无敌 ----
export const HP = {
  MAX: 3,
  INVULN: 1.0, // 被砸后无敌秒数
};

// ---- 能量伞（格挡资源管理）----
export const SHIELD = {
  MAX: 3, // 满格 3 次小物格挡
  REGEN_SEC: 6, // 每 6 秒恢复 1 格
  BIG_BREAK: true, // 挡大物 = 伞碎（盾清零）
};

// ---- 风带 ----
export const WIND = {
  // 地面三列风向：左列吹左（-1）、中央无风（0）、右列吹右（+1）。
  // 玩家横向速度 = 自身转向速度 + lane.dir * lane.strength（顺风加速 / 逆风减速）。
  LANES: [
    { x0: 0, x1: 427, dir: -1, strength: 150 },
    { x0: 427, x1: 853, dir: 0, strength: 0 },
    { x0: 853, x1: 1280, dir: 1, strength: 150 },
  ],
  STRONG: 230, // 雷雨波（wave 8）的加强风
};

// ---- near-miss / 风骚走位慢动作涟漪 ----
export const NEAR_MISS = {
  GAP: 20, // 擦身 <20px 且未命中
  THROTTLE: 0.6, // 单物节流（s）
};

export const RIPPLE = {
  CHAIN: 2, // 连续 2 次 near-miss 触发
  WINDOW: 2.0, // 两次 near-miss 间隔上限（s）
  DURATION: 1.2, // 慢动作持续（s，sim 时间）
  SLOW: 0.45, // 慢动作时掉落物速度倍率
};

// ---- 无人机追踪 ----
export const DRONE = {
  HOMING: 90, // 横向追踪加速度（px/s²）
  MAX_VX: 130, // 横向速度上限
};

// ---- 掉落物 ----
export const ITEMS = {
  // small（可被伞挡，扣 1 盾）；big（挡=伞碎，不挡扣 2 血）；drone（追踪，按 small 处理）
  bottle: { kind: 'small', r: 18, dmg: 1, label: 'bottle' },
  pot:    { kind: 'small', r: 22, dmg: 1, label: 'flowerpot' },
  cup:    { kind: 'small', r: 19, dmg: 1, label: 'cup' },
  can:    { kind: 'small', r: 20, dmg: 1, label: 'can' },
  drone:  { kind: 'drone', r: 20, dmg: 1, label: 'drone' },
  fridge: { kind: 'big', r: 44, dmg: 2, label: 'fridge' },
  sofa:   { kind: 'big', r: 46, dmg: 2, label: 'sofa' },
  tv:     { kind: 'big', r: 40, dmg: 2, label: 'tv' },
};

// ---- 风格分评级（风骚值）----
export const STYLE = {
  RATING: [
    { grade: 'S', min: 60 },
    { grade: 'A', min: 40 },
    { grade: 'B', min: 20 },
    { grade: 'C', min: 8 },
    { grade: 'D', min: 0 },
  ],
};

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// x → 风带
export function laneAt(x, lanes = WIND.LANES) {
  for (const l of lanes) {
    if (x >= l.x0 && x < l.x1) return l;
  }
  return lanes[lanes.length - 1];
}

// 风格分 → 评级
export function gradeFor(style) {
  for (const g of STYLE.RATING) {
    if (style >= g.min) return g.grade;
  }
  return 'D';
}
