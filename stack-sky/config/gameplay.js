// STACK SKY · 玩法数值配置（全部数值常量都在这，逻辑不写死数字）
// 契约：docs/README.md（事件名/字段一字不差）

// ---- 世界 / 坐标 ----
export const WORLD = {
  WIDTH: 1280,        // 逻辑世界宽（px）
  HEIGHT: 720,        // 逻辑世界高（px）
  GROUND_Y: 660,      // 塔基底边 y（世界坐标，y 向下）
};

export const STEP = 1 / 60;   // 固定步长（秒）

// ---- 叠塔核心（经典 Stack 手感 + 云端岛屿改造）----
export const STACK = {
  START_WIDTH: 220,       // 初始岛宽（px）
  MIN_WIDTH: 34,          // 岛宽低于此值判负
  BLOCK_H: 44,            // 每层岛高（px）
  PERFECT_TOLERANCE: 5,   // |偏移| ≤ 该值 = perfect（完全对齐）
  PERFECT_RECOVER: 14,    // perfect 恢复的宽度
  CLOUD_WRAP_COMBO: 3,    // perfect×3 触发「彩云缠绕」签名
  OSC_RANGE: 240,         // 移动岛以塔心为中心的半幅摆动范围（px）
  NEAR_MISS_CUT: 9,       // 裁边 ≤ 该值 = nearMiss（差一点）
};

// ---- 风切（每 10 层一阵横风，把移动岛吹偏）----
export const WIND = {
  EVERY_LAYERS: 10,            // 每 N 层触发一次横风
  STRENGTH: [0, 150, 240, 330], // 按风级（0..3）的横漂速度 px/s
  DURATION_SEC: 1.5,           // 单阵风持续时间
};

// ---- 神龛层（每 15 层一次机会对齐纹样，恢复初始宽度）----
export const SHRINE = {
  EVERY_LAYERS: 15,
  TOLERANCE: 6,      // |偏移| ≤ 该值 = 神龛对齐成功
};

// ---- 镜头 ----
export const CAMERA = {
  TARGET_SCREEN_Y: 470,   // 塔顶固定出现的屏幕 y
  FIXED_LAYERS: 4,        // 前 N 层镜头不动
};

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// 层号 → 岛屿主题（民居→花园→佛塔→天宫）
export function islandTheme(layerIndex) {
  if (layerIndex < 6) return 'house';
  if (layerIndex < 12) return 'garden';
  if (layerIndex < 20) return 'pagoda';
  return 'palace';
}
