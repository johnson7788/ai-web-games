// 玩法数值（M1）：玩家物理 / 敌人行为树 / 收集 / 鼓点跳 / 机关。全部 config-first，逻辑层不写死数字。
export const P = {
  W: 34,
  H: 42,
  RUN: 272,            // 地面奔跑速度 px/s
  ACCEL: 2700,
  AIR_ACCEL: 2100,
  FRICTION: 0.80,      // 地面摩擦（每帧乘子）
  GRAVITY: 1920,       // px/s^2
  MAX_FALL: 900,
  JUMP_VY: -660,
  DOUBLE_VY: -624,
  COYOTE_S: 0.12,      // 土狼时间
  BUFFER_S: 0.14,      // 跳跃缓冲
  WALL_SLIDE_MAX: 128, // 贴墙下滑最大速度
  WALL_JUMP_VX: 330,
  WALL_JUMP_VY: -648,
  STOMP_VY: -560,      // 踩敌回弹
  HP: 3,
  LIVES: 3,
  INVULN_S: 1.2,
  SPRING_VY: -920,
  WIND_FORCE: 250,
  BEAT_BPM: 128,       // 鼓点跳：与程序化 BGM 同 tempo
  BEAT_WINDOW: 0.11,   // 距节拍 ±比例内起跳命中
  BEAT_BONUS: 1.15,    // 命中节拍跳跃高度 +15%
};

export const ENEMY = {
  W: 32,
  H: 32,
  PATROL_SPEED: 70,
  CHASE_SPEED: 140,
  SIGHT: 260,          // 行为树 Look 半径（原作 Lib/Look.js radio=150 的适配）
};

export const COLLECT = {
  COIN_R: 9,
  STAR_R: 13,
  PICKUP: 36,
};

export const CAM = {
  LOOKAHEAD: 300,
  MILESTONE_PX: 60,    // 每前进 60px 发一次细粒度里程碑事件（保证事件密度）
};

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
