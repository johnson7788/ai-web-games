// config/gameplay.js — DICE CASCADE 玩法数值（M1 所有，纯数据 + 少量纯函数）
// 骰子 / 押注 / 弹珠板 / 回合节奏 / 符文成长，全部从这里读，逻辑层不写死数字。

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// ---------- 骰子 ----------
export const DICE = {
  SIDES: 6,          // 骰面 1..6
  WIN_FACE_MIN: 4,   // 押注命中判定：face >= 4 视为「高面」命中（概率 3/6 = 50%）
  CURSED_FACE: 1,    // 诅咒阶段：面 1 变为负点
};

// ---------- 押注 ----------
export const BET = {
  MULT_ONE: 2,       // 押中 1 个骰位 → 本回合收益 ×2
  MULT_MULTI: 3,     // 押中 ≥2 个骰位 → 本回合收益 ×3
};

// ---------- 弹珠板（Galton 板，确定性可 seed） ----------
export const BOARD = {
  LANES: 3,                                  // 顶部 3 个入珠区（骰面 1-2/3-4/5-6 → 区 0/1/2）
  ROWS: 6,                                   // 钉子决策行数
  BUCKETS: 7,                                // 底部 7 个得分桶（左→右）
  BUCKET_MULT: [4, 2, 1, 1, 1, 2, 4],        // 桶倍率：边缘高、中心低（中心命中概率最高）
  RUNE_BUCKET: 3,                            // 中央桶额外给符文碎片
  // 画布几何（逻辑 1280×720）
  BOARD_LEFT: 300,
  BOARD_RIGHT: 980,
  ENTRY_Y: 130,                              // 入珠区中心 y
  PEG_TOP: 180,
  PEG_BOTTOM: 470,
  BUCKET_Y: 505,
  BUCKET_H: 60,
  LANE_X: [430, 640, 850],                   // 3 个入珠区 x 中心
};

// ---------- 回合节奏 ----------
export const ROLL_SETTLE_SEC = 1.5;          // 掷骰后弹珠落桶的结算动画时长
export const AUTO_ROLL_SEC = 6;              // 长时间无输入时自动掷（0 押注），保证 noinput 会自动推进

// ---------- 三连符文（signature） ----------
export const TRIPLE_BONUS = 20;              // 三骰同面 → 神殿门金光 + 额外分

// ---------- 幸运轮 ----------
export const LUCKY = {
  CHANCE: 0.25,                              // 幸运轮关卡：每回合触发随机奖励的概率
  BONUS_MIN: 2,
  BONUS_MAX: 10,
};

// ---------- 符文槽（跨局永久小成长） ----------
export const RUNES = {
  SHARDS_PER_LEVEL: 5,
  MAX_LEVEL: 8,
  LEVELS: [
    { id: 'extraRoll',   kind: 'rule', desc: '每关 +1 投掷次数' },
    { id: 'betRebate',   kind: 'rule', desc: '押注命中返还 20% 押注成本' },
    { id: 'tripleBoost', kind: 'rule', desc: '三连符文奖励 ×2' },
    { id: 'cursedWard',  kind: 'rule', desc: '每关首次诅咒面被抵消' },
    { id: 'luckyCharm',  kind: 'rule', desc: '幸运轮奖励 ×2' },
    { id: 'strongStart', kind: 'stat', desc: '每关开局 +30 底分' },
    { id: 'scoreFocus',  kind: 'stat', desc: '收手结算 +5% 分' },
    { id: 'runeAffinity', kind: 'rule', desc: '中央符文桶额外 +1 碎片' },
  ],
};

// ---------- 纯函数 ----------
export function clamp(v, lo, hi) {
  if (Number.isNaN(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

// 骰面 → 入珠区（1-2→0, 3-4→1, 5-6→2）
export function faceToLane(face) {
  return clamp(Math.ceil(face / 2) - 1, 0, BOARD.LANES - 1);
}
