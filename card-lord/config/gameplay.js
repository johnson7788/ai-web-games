// config/gameplay.js — 牌局 / 段位 / AI / 结算 数值（全部 config-first，逻辑层不写死数字）
export const DECK = {
  RANKS: 13,          // 3..A,2 共 13 个点数
  SUITS: 4,
  SMALL_JOKER: 16,
  BIG_JOKER: 17,
  MIN_RANK: 3,        // 3
  MAX_STRAIGHT_RANK: 14, // A（顺子/连对/飞机不许含 2 和王）
  TWO_RANK: 15,       // 2
};

export const DEAL = {
  HAND: 17,
  HOLE: 3,
  SEATS: 3,
  HUMAN_SEAT: 0,
};

export const BID = {
  MAX: 3,
  NONE: 0,
};

export const DOUBLE = {
  MAX_MULTIPLIER: 64,
  BASE_MULTIPLIER: 1,
};

// 12 局段位：胜利升段；底分递增 + AI 强度递进（newElement 与 design.json 对齐）
export const TIERS = [
  { index: 1, baseScore: 1, aiSkill: 0.20, name: 'novice' },
  { index: 2, baseScore: 1, aiSkill: 0.28, name: 'bronze' },
  { index: 3, baseScore: 1, aiSkill: 0.35, name: 'silver' },
  { index: 4, baseScore: 2, aiSkill: 0.42, name: 'gold' },
  { index: 5, baseScore: 2, aiSkill: 0.48, name: 'platinum' },
  { index: 6, baseScore: 2, aiSkill: 0.54, name: 'diamond' },
  { index: 7, baseScore: 3, aiSkill: 0.60, name: 'master' },
  { index: 8, baseScore: 3, aiSkill: 0.65, name: 'grandmaster' },
  { index: 9, baseScore: 3, aiSkill: 0.70, name: 'cyber' },
  { index: 10, baseScore: 4, aiSkill: 0.75, name: 'neon' },
  { index: 11, baseScore: 4, aiSkill: 0.80, name: 'overlord' },
  { index: 12, baseScore: 5, aiSkill: 0.85, name: 'cardlord' },
];

export const TIER_NAMES = {
  en: ['Novice', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster', 'Cyber', 'Neon', 'Overlord', 'CARD LORD'],
  zh: ['新手', '青铜', '白银', '黄金', '铂金', '钻石', '大师', '宗师', '赛博', '霓虹', '霸主', '牌王'],
};

export const SCORING = {
  SPRING_MULT: 2,       // 春天：地主胜且农民一手未出
  ANTI_SPRING_MULT: 2,  // 反春天：农民胜且地主只出过一手
};

// AI 出牌/叫分参数（skill 0..1）
export const AI = {
  // 叫分评分权重（王炸/炸弹/大王/小王/每张2）
  bidWeights: { rocket: 8, bomb: 6, bigJoker: 4, smallJoker: 3, two: 2 },
  // 基础叫分阈值（score >= threshold → 对应分）
  bidThresholds: [7, 5, 3],
  // 低技能时的加严量：threshold += (1 - skill) * this
  bidSkillPad: 3,
  // 加倍概率基准（skill 高、牌强更可能加倍）
  doubleProb: 0.35,
  // 只剩 N 张牌以内时考虑出炸弹
  bombShortCards: 6,
  // 跟牌时农民给队友（非地主方）出大牌的阈值
  farmerMaxBelow: 14,
};

// 每步模拟时间（秒，用于遥测 clock，不驱动真实渲染）
export const STEP_TIME = 0.4;

// 单局最大步数保护（防软锁）
export const MAX_ROUND_STEPS = 1200;
