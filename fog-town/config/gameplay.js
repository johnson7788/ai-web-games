// FOG TOWN · 玩法数值配置（全部数值常量都在这，逻辑不写死数字）
// 契约：docs/analysis.md 与 README.md（事件名/字段一字不差）

// ---- 网格 ----
export const GRID = {
  COLS: 12,
  ROWS: 8,
  CELL: 82, // 渲染格边长（逻辑 px，1280×720 letterbox 内）
};

// 格子类型（cells 2D 数组里存的整数）
export const T = {
  FLOOR: 0,
  WALL: 1,
  EXIT: 2,
  KEY: 3,
  CLUE: 4,
  LEVER: 5,
  TRAP: 6,
  GUARD: 7,
};

export const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export const DIR_NAMES = Object.keys(DIRS);

// ---- 灯油 / 光半径 ----
export const OIL = {
  RADIUS_MAX: 3, // 油充足时的照亮半径（格）
  RADIUS_MIN: 1, // 油尽时缩到脚边
  BASE_MULT: 2.0, // oil = optimalPath * 2.0 + BASE_ADD
  BASE_ADD: 4,
  LOW_WARN: 0.3, // 剩余比例 ≤ 该值发 oilLow 事件
};

// ---- 步数 / 失败 ----
export const STEPS = {
  MAX_MULT: 3.6, // maxSteps = optimalPath * 3.6 + SLACK（超过 = 迷雾吞噬，失败）
  SLACK: 6,
};

// ---- 回声 ----
export const ECHO = {
  RANGE: 2, // 探听切比雪夫距离 ≤2 的机关（陷阱/杠杆）
  COOLDOWN_STEPS: 2, // 两次回声之间至少间隔的步数
};

// ---- 真相时刻 ----
export const TRUTH = {
  DURATION: 2.5, // 全图点亮时长（秒，真实时间）
  CLUE_TARGET: 3, // 拼齐 3 条线索触发
};

// ---- 守卫 ----
export const GUARD = {
  VISION: 1, // 视线长度（格）：守卫格 + 其 4 邻格都是危险区
};

// ---- 陷阱 ----
export const TRAP = {
  OIL_COST: 2, // 踩陷阱额外掉油
};

// ---- 移动雾 ----
export const MOVING_FOG = {
  MEMORY: 26, // 只保留最近 26 次揭示的格子，更早的重新起雾
};

// ---- 评分 / 重玩钩子 ----
export const RATING = {
  S_MULT: 1.35, // 步数 ≤ optimal*1.35 → S
  A_MULT: 1.7,
  B_MULT: 2.3,
};

// ============================================================
// 纯函数（无副作用，供 sim/mapgen 复用；数字全部来自上面的常量）
// ============================================================

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** 灯半径：随剩余油量比例从 RADIUS_MAX 线性缩到 RADIUS_MIN。 */
export function lightRadius(oil, oilStart) {
  const frac = oilStart > 0 ? clamp(oil / oilStart, 0, 1) : 0;
  return Math.max(OIL.RADIUS_MIN, Math.ceil(frac * OIL.RADIUS_MAX));
}

/** 步数评级：S/A/B/C（越少越好）。 */
export function ratingOf(steps, optimal) {
  if (optimal <= 0) return 'C';
  const r = steps / optimal;
  if (r <= RATING.S_MULT) return 'S';
  if (r <= RATING.A_MULT) return 'A';
  if (r <= RATING.B_MULT) return 'B';
  return 'C';
}

/** 切比雪夫距离（网格） */
export function cheb(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** 曼哈顿距离（网格） */
export function manh(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** 索引 ↔ 坐标 */
export function idx(x, y) {
  return y * GRID.COLS + x;
}
export function coord(i) {
  return { x: i % GRID.COLS, y: Math.floor(i / GRID.COLS) };
}
export function inBounds(x, y) {
  return x >= 0 && x < GRID.COLS && y >= 0 && y < GRID.ROWS;
}
