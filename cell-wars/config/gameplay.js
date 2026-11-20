// cell-wars · M1 数值配置：全部玩法数值都在这，逻辑层不写死数字。
// 契约：docs/analysis.md + docs/README.md（事件名/字段一字不差）

export const STEP = 1 / 60; // 固定步长（秒）

// 格子归属（渲染/判定共用）
export const OWNER = {
  VOID: -1,   // 空洞（不可玩，地图形状用）
  NEUTRAL: 0, // 中立琼脂
  PLAYER: 1,  // 玩家蓝菌
  ENEMY: 2,   // 敌方红菌
};

// ---- 感染判定 ----
export const INFECT = {
  CAPTURE_COST_ADD: 1, // 占领一个格子的成本 = def + 1（即感染力 > def 才算成功）
  CAPTURED_DEF: 1,     // 被占领格子的防御重置为 1
  MAX_DEF: 4,          // 防御上限
  CHAIN_BIG: 3,        // ≥3 格连锁视为「大爆发」（触发光丝蔓延特效 + 音效分级）
};

// ---- 营养滴 ----
export const NUTRIENT = {
  AURA_BONUS: 2, // 该格及 4 邻格下回合感染力 +2
};

// ---- 噬菌体 ----
export const PHAGE = {
  SIZE: 2,          // 清空 2×2
  CHARGE_TURNS: 3,  // 3 回合充能一次
};

// ---- 回合节奏 ----
export const TURN = {
  AI_THINK_SEC: 0.4,        // 敌方思考延迟（秒，动画节奏）
  PLAYER_TIMEOUT_SEC: 3.0,  // 玩家回合超时自动 pass（noinput 兜底）
};

// ---- 病毒风暴 ----
export const VIRUS = {
  STORM_CHANCE: 0.5, // 每次风暴一个随机己方/敌方格突变为中立的概率
};

// ---- 特效时长 ----
export const FX = {
  SPREAD_SEC: 0.5,
  BURST_SEC: 0.45,
  BANNER_SEC: 1.4,
};

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// 占领成本：def + 1（即需要 power > def）
export function captureCost(def) {
  return def + INFECT.CAPTURE_COST_ADD;
}
