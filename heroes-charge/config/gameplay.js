// 玩法数值（源自 LightSword 侦察的 P0 事实表，已按 60fps 帧步长归一）
// 单位约定：速度 px/s，重力 px/s^2，帧数按 1/60s 一帧。

export const PLAYER = {
  SPEED: 150,                 // 平移速度 px/s
  JUMP_V: 500,                // 起跳初速 px/s（向上）
  GRAVITY: 1500,              // 重力 px/s^2
  MAX_HP: 5,                  // 血量（心数）
  DASH_SPEED: 900,            // 冲刺速度 px/s
  DASH_FRAMES: 12,            // 冲刺持续帧数（约 0.2s）
  DASH_COST: 0.25,            // 冲刺消耗能量（0–1）
  DASH_REGEN: 0.2 / 3,        // 冲刺能量回复 /s（满格约 15s，一次冲刺约 3.75s 回满）
  ATTACK_FRAMES: 12,          // 一次出招硬直帧数
  ATTACK_DAMAGE: 10,          // 普攻/技能单次伤害
  ATTACK_RANGE: 72,           // 普攻命中距离 px
  SPIN_RANGE: 96,             // 旋转斩范围 px
  SPIN_DAMAGE: 10,            // 旋转斩单次伤害
  BOLT_SPEED: 400,            // 光弹速度 px/s
  BOLT_DAMAGE: 10,            // 光弹伤害
  BOLT_HP: 5,                 // 光弹可穿次数
  COMBO_WINDOW: 2.5,          // 连击窗口秒
  INVULN_FRAMES: 60,          // 受击后无敌帧（1s）
};

export const ENEMY = {
  CHASE_DIST: 180,            // 巡逻 → 追猎距离
  ATTACK_DIST: 55,            // 追猎 → 攻击距离
  LOSE_DIST: 260,             // 追猎 → 放弃距离
  ATTACK_CD: 120,             // 敌人攻击冷却帧（2s）
};

export const ORB = {
  ENERGY_REFILL: 0.5,         // 能量球补冲刺能量
  SHIELD_EVERY: 3,            // 每击杀 N 个掉落一个护盾核心
  LIFETIME_FRAMES: 480,       // 掉落物存活帧数（8s）
};

export const SCORE = {
  KILL: 100,                  // 基础击杀分
  KILL_PER_COMBO: 25,         // 每 5 连击的击杀额外分
  ORB: 25,
  SHIELD: 50,
  LEVEL_CLEAR: 500,
  PER_STAR: 200,
};

export const TOTAL_LEVELS = 3;

// 关卡：width = 世界宽度；enemies = 敌人定义（x 出生点 / hp / speed / range / boss）
export const LEVELS = [
  {
    index: 1,
    width: 1500,
    enemies: [
      { x: 380, hp: 20, speed: 55, range: 150 },
      { x: 850, hp: 20, speed: 55, range: 120 },
      { x: 1250, hp: 20, speed: 55, range: 120 },
    ],
  },
  {
    index: 2,
    width: 1700,
    enemies: [
      { x: 420, hp: 30, speed: 70, range: 130 },
      { x: 820, hp: 30, speed: 70, range: 120 },
      { x: 1220, hp: 30, speed: 70, range: 120 },
      { x: 1550, hp: 30, speed: 70, range: 120 },
    ],
  },
  {
    index: 3,
    width: 1900,
    enemies: [
      { x: 420, hp: 40, speed: 85, range: 130 },
      { x: 780, hp: 40, speed: 85, range: 120 },
      { x: 1140, hp: 40, speed: 85, range: 120 },
      { x: 1500, hp: 40, speed: 85, range: 120 },
      { x: 1750, hp: 80, speed: 60, range: 60, boss: true },
    ],
  },
];

export const PLAYER_SPAWN_X = 180;
