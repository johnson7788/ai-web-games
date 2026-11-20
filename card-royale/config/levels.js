// CARD ROYALE · 关卡数据（Lead 拥有）
// 字段：index/scene/peaks/rows/redeals/frozen/wildcard/time/treasure/starScore/name。
// peaks = 牌峰数（1/2/3/5）；rows = 层数（自底向上）。
// 牌型由 buildPositions(peaks, rows) 生成：每峰为「上层盖下层相邻两列」的三角阵，多峰共用底座。
// 三场景包：candle-hall 烛光大厅（L1-4）/ royal-garden 王家花园（L5-8）/ treasure-vault 藏宝地窖（L9-12）。
// 可解性：随机洗牌 + 求解器验证（tests/solver.test.mjs 1000 种子 ≥95%）。

export const LEVELS = [
  { index: 1, scene: 'candle-hall', peaks: 1, rows: 3, redeals: 1, frozen: 0, wildcard: false, time: 0, treasure: 0, starScore: 70,  name: { en: 'First Court', zh: '初入宫廷' } },
  { index: 2, scene: 'candle-hall', peaks: 3, rows: 3, redeals: 1, frozen: 0, wildcard: false, time: 0, treasure: 0, starScore: 170, name: { en: 'Three Peaks', zh: '三峰牌桌' } },
  { index: 3, scene: 'candle-hall', peaks: 3, rows: 3, redeals: 0, frozen: 0, wildcard: false, time: 0, treasure: 0, starScore: 180, name: { en: 'Tight Hand', zh: '翻牌吃紧' } },
  { index: 4, scene: 'candle-hall', peaks: 2, rows: 4, redeals: 1, frozen: 0, wildcard: false, time: 0, treasure: 0, starScore: 210, name: { en: 'Mirror Hall', zh: '双峰镜像' } },
  { index: 5, scene: 'royal-garden', peaks: 3, rows: 4, redeals: 1, frozen: 3, wildcard: false, time: 0, treasure: 0, starScore: 300, name: { en: 'Frozen Court', zh: '冰封牌阵' } },
  { index: 6, scene: 'royal-garden', peaks: 3, rows: 4, redeals: 1, frozen: 0, wildcard: false, time: 0, treasure: 0, starScore: 300, name: { en: 'Suit Bonus', zh: '同花盛宴' } },
  { index: 7, scene: 'royal-garden', peaks: 3, rows: 4, redeals: 1, frozen: 0, wildcard: true, time: 0, treasure: 0, starScore: 310, name: { en: 'The Jester', zh: '万能鬼牌' } },
  { index: 8, scene: 'royal-garden', peaks: 3, rows: 4, redeals: 1, frozen: 0, wildcard: false, time: 150, treasure: 0, starScore: 320, name: { en: 'Timed Court', zh: '限时牌局' } },
  { index: 9, scene: 'treasure-vault', peaks: 3, rows: 4, redeals: 1, frozen: 0, wildcard: false, time: 0, treasure: 4, starScore: 340, name: { en: 'Crown Vault', zh: '藏宝冠冕' } },
  { index: 10, scene: 'treasure-vault', peaks: 3, rows: 4, redeals: 1, frozen: 2, wildcard: true, time: 0, treasure: 0, starScore: 340, name: { en: 'Frozen Jester', zh: '鬼牌冰封' } },
  { index: 11, scene: 'treasure-vault', peaks: 5, rows: 3, redeals: 2, frozen: 0, wildcard: false, time: 0, treasure: 0, starScore: 300, name: { en: 'Five Peaks', zh: '五峰大盘' } },
  { index: 12, scene: 'treasure-vault', peaks: 5, rows: 3, redeals: 2, frozen: 2, wildcard: true, time: 180, treasure: 5, starScore: 340, name: { en: 'Throne Finale', zh: '五峰王座' } },
];

export const LEVEL_COUNT = LEVELS.length;
