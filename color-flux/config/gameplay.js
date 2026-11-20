// COLOR FLUX · M1 玩法数值（全部数值常量都在这，逻辑不写死数字）
// 契约：事件名 / 接口签名与 docs/analysis.md 对照，sim 纯逻辑零 DOM。

// ---- 世界 / 坐标 ----
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
  BALL_X: 640,       // 萤固定屏幕 x
  FLOOR_Y: 600,      // 地板：球落到底自动弹起（不会因掉落判负）
  CEIL_Y: 40,        // 球中心上限（不飞出顶）
};

export const STEP = 1 / 60;

// ---- 6 色（全局唯一颜色词表；id 0..5）----
export const COLORS = [
  { id: 0, name: 'red',    hex: '#ff5d73' },
  { id: 1, name: 'orange', hex: '#ffb020' },
  { id: 2, name: 'yellow', hex: '#ffd93d' },
  { id: 3, name: 'green',  hex: '#3ddc84' },
  { id: 4, name: 'blue',   hex: '#4db8ff' },
  { id: 5, name: 'violet', hex: '#a86bff' },
];

export const COLOR_COUNT = COLORS.length;

// ---- 萤（球）物理（恒速起跳/下落，确定性可预测）----
export const BALL = {
  R: 22,            // 半径 px
  V_RISE: 640,      // 起跳上升速度 px/s
  V_FALL: 420,      // 自然下落速度 px/s
  V_HOVER: 110,     // 悬浮下落速度 px/s（按住减速，便于对准）
  RISE_HEIGHT: 90,  // 每次起跳上升高度（px，小步易控）
  // 悬浮表
  HOVER_MAX: 30.0,  // 悬浮表上限（秒）
  HOVER_DRAIN: 1.0, // 每秒消耗（秒）
  HOVER_REGEN: 10.0,// 每秒回复（秒）
};

// ---- 障碍（环带）----
export const RING = {
  RADIUS: 150,      // 环带半径（px）
  THICK: 26,        // 环带厚度（px）
  PASS_BAND: 30,    // |球y - 环y| 小于该值触发颜色判定
  GAP: 300,         // 相邻环带间距（px）
  SPAWN_Y: -160,    // 新生环带起始 y（屏外上方）
};

// ---- 韵律环（每 5 环）----
export const RHYTHM = {
  EVERY: 5,         // 每 5 环一个韵律环
  BEAT: 0.6,        // 节拍间隔（秒）：环段在每个节拍瞬间跳转到下一段
};

// ---- 双色萤（吃双色核心）----
export const DUAL = {
  DURATION: 5.0,    // 双色持续（秒）
  SECOND_OFFSET: 2, // 第二可用色 = 当前色 + 偏移
  SCORE_MULT: 0.5,  // 双色期间过环得分减半
};

// ---- 极光爆发（连续穿 10 环）----
export const BURST = {
  STREAK: 10,       // 连穿 10 环触发
  BONUS: 10,        // 爆发奖励分
};

// ---- 色换器 / 双色核心 ----
export const PICKUP = {
  R: 16,            // 拾取半径
  EVERY_RINGS: 4,   // 每过 N 环生成一个色换器
  DUAL_EVERY: 10,   // 每过 N 环生成一个双色核心（与色换器错开）
};

// ---- nearMiss ----
export const NEAR_MISS = {
  EDGE_DEG: 10,     // 距错误段边界 <10° 且未相交 = 擦肩
  THROTTLE: 1.5,    // 节流（秒）
};

// ---- 心跳脉冲（细粒度反馈 + 遥测事件密度）----
export const PULSE = {
  EVERY: 0.4,       // 每 0.4s 一次极光萤脉冲
};

// ---- 推进 / 12 段 ----
export const PROGRESS = {
  RINGS_PER_SEGMENT: 4, // 每段目标环数
  MAX_SEGMENT: 12,
};

// ---- 形状（判定统一用 6 色段，保证任意萤色都能通过；形状只决定绘制样式）----
// 风车用 12 段（每色两次、匹配窗更窄更难），其余 6 段。
export const SEGMENT_COUNT = 6;

export const SHAPES = {
  arc2:     6,   // 双弧：6 段，视觉为上下双弧
  cross:    6,   // 十字：6 段，视觉为十字辐条
  ring:     6,   // 单环：6 段，完整圆环
  windmill: 12,  // 风车：12 段（每色两次，匹配窗更窄）
  nested:   6,   // 嵌套双环：内环 6 段参与判定，外环反向旋转为装饰
};

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
