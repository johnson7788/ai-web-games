// EGG BOOM · 数值配置（全部数值常量都在这，逻辑不写死数字）
// 契约：docs/analysis.md（事件名 / 字段一致）

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  EGG_X: 220,          // 蛋固定屏幕 x
};

export const STEP = 1 / 60;

// ---- 蛋（弹簧蛋） ----
export const EGG = {
  R: 28,               // 碰撞半径
  REST_Y: 640,         // 蛋静止中心 y（= 第 6 行地面行）
  CHARGE_TIME: 0.5,    // 蓄满所需秒数
  MIN_CHARGE: 0.03,    // 蓄力进入门槛（低于此不跳，防误触）
  JUMP_MIN: 300,       // 最小起跳初速（px/s，向上）
  JUMP_MAX: 1680,      // 满蓄力起跳初速（可到第 1 行）
  GRAVITY: 2600,       // 重力（px/s²）
  AMMO_START: 28,      // 开局米粒弹药
  AMMO_MAX: 46,
  INVULN: 0.6,         // 撞碎壳后无敌秒数
};

// ---- 行（障碍垂直排布，108px 间距；顶行及「!」标记在 HUD 条下方） ----
export const ROWS = {
  Y: [100, 208, 316, 424, 532, 640],  // 6 行中心 y（第 6 行 = 地面行）
  COUNT: 6,
};

// ---- 射击 ----
export const SHOOT = {
  AUTO_INTERVAL: 0.3,  // 自动射击间隔（s）
  MANUAL_COOLDOWN: 0.16, // 手动加射冷却
  BULLET_SPEED: 780,   // 米粒弹水平速度（px/s）
  BULLET_W: 14,        // 子弹命中半宽
  BULLET_H: 24,        // 子弹命中半高（可打同一行的团）
  BASE_POWER: 1,       // 每发 -1 耐久
};

// ---- 连击 / 蛋黄溅射 ----
export const COMBO = {
  WINDOW: 2.5,         // 破团后 2.5s 内再破 +1
  YOLK_AT: 5,          // 连击到 5 → 下一发手动弹变蛋黄范围弹
  YOLK_RADIUS: 150,    // 范围弹溅射半径
  YOLK_POWER: 1,       // 范围弹对每团的伤害
};

// ---- 面团障碍 ----
export const DOUGH = {
  R: 26,               // 碰撞半径
  BASE_VALUE: 1,       // 第 1 关基础值
  VALUE_PER_LEVEL: 1,  // 每关值上限 +1
  ARMORED_UNLOCK: 6,   // 第 6 关起出现护甲团
  MOVE_AMP: 46,        // 移动团垂直振幅（px）
  MOVE_PERIOD: 2.2,    // 移动团周期（s）
};

// ---- 道具 ----
export const PROP = {
  DROP_CHANCE: 0.25,   // 破团掉道具概率
  RACK_CLEAR_CHANCE: 0.5, // 清整排额外掉道具概率
  SCORE_GAIN: 60,      // 分数道具加分
  AMMO_GAIN: 10,       // 弹药道具加弹
  FIRE_DURATION: 8,    // 火力道具持续秒数
  FIRE_POWER: 2,       // 火力道具：每发伤害 ×2
  PICKUP: 64,          // 拾取半径
};

// ---- 滚动 / 关卡 ----
export const SCROLL = {
  BASE: 190,           // 基础滚动速度（px/s）
  PER_LEVEL: 12,       // 每关 +12
  MAX: 320,
};

export const LEVEL = {
  COUNT: 12,
  DIST: 2600,          // 每关滚动距离（px）
  RACK_GAP: 330,       // 相邻排（rack）间距
  LOOKAHEAD: 900,      // 前方预生成距离
};

// ---- 分数 ----
export const SCORE = {
  RACK_CLEAR_BONUS: 80,
  RACK_CLEAR_AMMO: 4,   // 清整排额外补 4 弹
};

// ---- 护甲（蛋壳） ----
export const SHELL = {
  START: 1,            // 每关开局 1 层壳
  REGROW_SEC: 10,      // 撞碎后 10s 长回
};

// ---- 里程碑事件（保证反馈密度） ----
export const MILESTONE = {
  EVERY_PX: 100,       // 每 100px 一个滚动里程碑事件
};

// ============================================================
// 纯函数
// ============================================================

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// 距离 → 关卡（1-based，封顶 12）
export function levelAt(distance) {
  return clamp(Math.floor(distance / LEVEL.DIST) + 1, 1, LEVEL.COUNT);
}

// 关卡 → 滚动速度
export function scrollAt(level) {
  return Math.min(SCROLL.MAX, SCROLL.BASE + (level - 1) * SCROLL.PER_LEVEL);
}

// 某关面团值的上限（护甲团在 6+ 关才出现，正常值随关卡升高）
export function doughValueMaxAt(level, rng) {
  const top = DOUGH.BASE_VALUE + DOUGH.VALUE_PER_LEVEL * (level - 1);
  // 均匀 1..top
  return 1 + Math.floor(rng() * Math.max(1, top));
}

// 该关是否可出现护甲团
export function armoredUnlocked(level) {
  return level >= DOUGH.ARMORED_UNLOCK;
}

// 该关是否可出现移动团（第 4 关起）
export function movingUnlocked(level) {
  return level >= 4;
}

// 面团当前屏幕 y（移动团按正弦往返）
export function doughYAt(d, time) {
  const base = ROWS.Y[(d.row || 1) - 1];
  if (!d.moving) return base;
  const t = time / DOUGH.MOVE_PERIOD * Math.PI * 2;
  return base + Math.sin(t + (d.phase || 0)) * DOUGH.MOVE_AMP;
}

// 实体屏幕 x：从 atDistance 换算（世界向左滚动，蛋固定在 EGG_X）
export function screenXAt(atDistance, distance) {
  return WORLD.EGG_X + (atDistance - distance);
}
