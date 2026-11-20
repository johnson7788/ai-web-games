// 全局数值配置 —— 唯一数值源。逻辑层不写死数字。
export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,
};

export const STEP = 1 / 60;

// 语言：默认英文；zh 必做（当前只暴露 en/zh，未翻译语言整块不列）
export const CONFIG = {
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: [],
  langStorageKey: 'blindbox-memory-lang',
  langNames: { en: 'English', zh: '中文' },
  saveKey: 'blindbox-memory-save',
};

// ---- 牌桌与规则 ----
export const RULES = {
  peekPerRun: 3,             // 每局免费提示次数
  peekRefill: 3,             // 看一次广告补充的次数
  peekMaxRefillPerRun: 2,    // 每局补充上限
  reviveMoves: 5,            // 复活（看广告）补的步数
  comboRefundFrom: 4,        // 第 N 连击起每次配对返还 1 步（升级后）
  shuffleEveryMisses: 6,     // 幻影洗牌：每 N 次误配触发
  flashRevealMs: 1200,       // 开局闪现时长
  mismatchHoldMs: 750,       // 误配后两张牌亮多久翻回
  star3MovesRatio: 0.4,      // 剩余步数 ≥ 40% = 3 星
  star2MovesRatio: 0.2,      // ≥ 20% = 2 星
  coinPerPair: 5,
  coinStarPairBonus: 10,     // 星卡配对额外金币
  coinLevelClear: 10,        // 过关基础
  coinPerStar: 10,
  coinFirst3Star: 20,        // 首次 3 星奖励
};

// ---- 升级（图鉴/商店）----
export const UPGRADES = [
  { id: 'extra-moves-1', kind: 'stat', cost: 100, detail: { en: '+3 moves every level', zh: '每关步数 +3' } },
  { id: 'extra-moves-2', kind: 'stat', cost: 200, detail: { en: '+3 more moves', zh: '步数再 +3' }, requires: 'extra-moves-1' },
  { id: 'combo-refund', kind: 'rule', cost: 120, detail: { en: '4+ combo refunds 1 move per match', zh: '第 4 连击起每次配对返还 1 步' } },
  { id: 'peek-plus', kind: 'rule', cost: 150, detail: { en: 'Peek reveals the twin of a tapped card', zh: '精准提示：点一张卡只亮它的配对' } },
  { id: 'combo-shield', kind: 'rule', cost: 80, detail: { en: 'First miss each run keeps combo', zh: '每局首次误配不清连击' } },
  { id: 'shuffle-block', kind: 'rule', cost: 90, detail: { en: 'Pay 20 coins to block one shuffle', zh: '花 20 金币阻止一次幻影洗牌' } },
  { id: 'star-bonus', kind: 'rule', cost: 110, detail: { en: '3-star clear: leftover moves become coins', zh: '3 星通关剩余步数 1:1 转金币' } },
  { id: 'collector-peek', kind: 'rule', cost: 0, detail: { en: '+1 free peek per 10 collected', zh: '图鉴每满 10 个角色 +1 免费提示' }, auto: true },
];

// ---- 关卡（每关一个新元素）----
export const LEVELS = [
  { index: 1, cols: 4, rows: 3, pairs: 6,  moves: 18, tutorial: true, failSafe: true,  newElement: 'basic' },
  { index: 2, cols: 4, rows: 4, pairs: 8,  moves: 20, tutorial: false, failSafe: false, newElement: 'bigger' },
  { index: 3, cols: 4, rows: 4, pairs: 8,  moves: 18, starPairs: 1, tutorial: false, failSafe: false, newElement: 'star' },
  { index: 4, cols: 5, rows: 4, pairs: 10, moves: 22, obstacles: 2, tutorial: false, failSafe: false, newElement: 'obstacle' },
  { index: 5, cols: 5, rows: 4, pairs: 10, moves: 22, mirrorPairs: 3, tutorial: false, failSafe: false, newElement: 'mirror' },
  { index: 6, cols: 6, rows: 4, pairs: 12, moves: 26, decoy: true, tutorial: false, failSafe: false, newElement: 'decoy' },
  { index: 7, cols: 6, rows: 4, pairs: 12, moves: 26, decoy: true, comboRefund: true, tutorial: false, failSafe: false, newElement: 'combo' },
  { index: 8, cols: 6, rows: 4, pairs: 12, moves: 24, obstacles: 2, starPairs: 1, decoy: true, comboRefund: true, tutorial: false, failSafe: false, newElement: 'mix-a' },
  { index: 9, cols: 6, rows: 4, pairs: 12, moves: 26, phantomShuffle: true, decoy: true, comboRefund: true, tutorial: false, failSafe: false, newElement: 'phantom' },
  { index: 10, cols: 6, rows: 4, pairs: 12, moves: 24, flash: true, decoy: true, comboRefund: true, tutorial: false, failSafe: false, newElement: 'flash' },
  { index: 11, cols: 6, rows: 4, pairs: 8,  moves: 20, quads: 4, decoy: true, comboRefund: true, tutorial: false, failSafe: false, newElement: 'quads' },
  { index: 12, cols: 6, rows: 5, pairs: 15, moves: 30, obstacles: 2, starPairs: 2, phantomShuffle: true, flash: true, decoy: true, comboRefund: true, tutorial: false, failSafe: false, newElement: 'boss' },
];
