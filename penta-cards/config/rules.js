// config/rules.js — 玩法数值：牌面 / 番型 / 场景包 / 12 局推进 / AI 强度（config-first）。
// 卡五星核心规则还原（源码侦察结论，见 docs/analysis.md）：
//   · 3 人、84 张牌（星 1-9 ×4、轨 1-9 ×4、三元 3×4），无风无万。
//   · 每局 13 张起，庄家 14 张打 1；胡牌 = 4 副牌 + 1 对（或 7 对等特殊型）。
//   · 番型：平胡0 / 对对胡1 / 七对2；清一色+2、大小三元+3/+2、卡五星+1、明/暗四归+1/+2、
//     手抓一+2、杠开/杠上炮/抢杠+1、明牌+1、海底+1。分数 = 2^番 × 底注，封顶。
//   · signature「卡五星」：听 5（星5 或 轨5）夹在 4 与 6 之间成牌。

// 牌 id：0-8 星（原筒），9-17 轨（原条），27-29 三元（原中发白）。
export const TILE = {
  STAR: 0,        // 星 1-9（id 0-8）
  ORBIT: 9,       // 轨 1-9（id 9-17）
  HONOR: 27,      // 三元：日 27 / 月 28 / 斗 29
};

export const SUITS = [
  { key: 'star', begin: 0, end: 9, labelKey: 'suit.star' },
  { key: 'orbit', begin: 9, end: 18, labelKey: 'suit.orbit' },
  { key: 'honor', begin: 27, end: 30, labelKey: 'suit.honor' },
];

export const HONOR_NAMES = {
  27: 'honor.sun',
  28: 'honor.moon',
  29: 'honor.pole',
};

export function suitOf(id) {
  if (id >= 0 && id < 9) return 0;
  if (id >= 9 && id < 18) return 1;
  return 2;
}

// 5 星 = id 4，5 轨 = id 13（卡五星 signature）
export const KAWUXING_TILES = [4, 13];

export const TOTAL_TILES = 84; // 36 + 36 + 12
export const SEATS = 3;

// 基础番（源码 gamemgr_kwx.js getFan / checkCanTingPai 的 tingMap.fan）
export const BASE_FAN = {
  normal: 0,
  duidui: 1,
  '7pairs': 2,
};

export const BONUS_FAN = {
  qingyise: 2,     // 清一色
  dasanyuan: 3,    // 大三元
  xiaosanyuan: 2,  // 小三元
  kawuxing: 1,     // 卡五星
  mingsigui: 1,    // 明四归
  ansigui: 2,      // 暗四归
  jingouhu: 2,     // 手抓一（剩 1-2 张胡）
  gang: 1,         // 杠开 / 杠上炮 / 抢杠
  mingpai: 1,      // 明牌
  haidi: 1,        // 海底捞 / 海底炮
};

export const MAX_FAN = 8;

// 番 → 倍数（2^fan）
export function fanMultiplier(fan) {
  return 1 << Math.max(0, Math.min(MAX_FAN, fan));
}

// 场景包（换章必换色板 + 构图 + 装饰）
export const SCENES = [
  { id: 'observatory', begin: 1, end: 4, labelKey: 'scene.observatory' },
  { id: 'teahouse', begin: 5, end: 8, labelKey: 'scene.teahouse' },
  { id: 'aurora', begin: 9, end: 12, labelKey: 'scene.aurora' },
];

export function sceneForRound(round) {
  return SCENES.find((s) => round >= s.begin && round <= s.end) || SCENES[0];
}

// 12 局段位推进：AI 强度递进 + 底注递增 + 场景换章。
export const ROUNDS = Array.from({ length: 12 }, (_, i) => {
  const round = i + 1;
  return {
    index: round,
    scene: sceneForRound(round).id,
    baseBet: 1 + Math.floor((round - 1) / 3),      // 1,1,1, 2,2,2, 3,3,3, 4,4,4
    aiSkill: Math.min(0.9, 0.25 + i * 0.06),       // 0.25 → 0.9
  };
});

// 底注对应的段位目标筹码（12 局后总分 > 0 判胜，按评级给钩子）
export const RANK = {
  startChips: 20,
  winTarget: 1, // 总分 > 0 即晋级
};

// 观星 / 换星 每局限用次数（spec 原创区别点）
export const ABILITY = {
  stargaze: 2,   // 每局看牌堆顶 3 张
  swap: 1,       // 每局弃 1 换 1（对手可见）
  stargazePeek: 3,
};

// AI 难度曲线对牌型评估的噪声（越低越准）
export const AI = {
  // 换星 / 观星只有玩家可用（对手观察）
  playerOnly: true,
};

// 回合思考步数（sim 时间推进粒度，用于遥测）
export const TIME_PER_STEP = 0.6;
