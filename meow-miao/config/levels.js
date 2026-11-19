// 关卡定义（程序化生成牌堆；这里只放每关的生成参数与难度曲线）。
// symbols：不同花色数（每色 3 块）；wilds：万能牌数（3 的倍数）；rocks：岩石格数（不可用格，压缩棋盘）；
// cols/rows：棋盘脚印；stackBias：复用已有柱子（叠高）的概率，越高遮挡越重。
export const LEVEL_COUNT = 10;

export const LEVELS = [
  { index: 1, name: { en: 'First Stack', zh: '初次叠堆' }, symbols: 4, wilds: 0, rocks: 0, cols: 6, rows: 5, stackBias: 0.15 },
  { index: 2, name: { en: 'Wild Star', zh: '万能星' }, symbols: 5, wilds: 3, rocks: 0, cols: 6, rows: 5, stackBias: 0.30 },
  { index: 3, name: { en: 'Rock Garden', zh: '岩石园' }, symbols: 6, wilds: 3, rocks: 3, cols: 6, rows: 6, stackBias: 0.40 },
  { index: 4, name: { en: 'Tight Corner', zh: '逼仄角落' }, symbols: 6, wilds: 3, rocks: 4, cols: 6, rows: 6, stackBias: 0.50 },
  { index: 5, name: { en: 'Rising Heat', zh: '热度攀升' }, symbols: 7, wilds: 3, rocks: 5, cols: 7, rows: 6, stackBias: 0.55 },
  { index: 6, name: { en: 'Twin Wilds', zh: '双万能' }, symbols: 7, wilds: 6, rocks: 6, cols: 7, rows: 7, stackBias: 0.60 },
  { index: 7, name: { en: 'Deep Pile', zh: '深牌堆' }, symbols: 8, wilds: 6, rocks: 7, cols: 7, rows: 7, stackBias: 0.65 },
  { index: 8, name: { en: 'Neon Peak', zh: '霓虹之巅' }, symbols: 8, wilds: 6, rocks: 8, cols: 8, rows: 7, stackBias: 0.70 },
  { index: 9, name: { en: 'Crowded Shine', zh: '拥挤流光' }, symbols: 8, wilds: 6, rocks: 9, cols: 8, rows: 7, stackBias: 0.75 },
  { index: 10, name: { en: 'Final Glow', zh: '终极辉光' }, symbols: 8, wilds: 6, rocks: 10, cols: 8, rows: 8, stackBias: 0.80 },
];

// 倒计时（秒）：沿用原版公式 getTimer(level)，约 60~66s。
export function levelTime(levelIndex) {
  const level = levelIndex + 1;
  return 60 + Math.floor(level / 4 + (level / 30) * 4 + (level / 100) * 15 + (level / 240) * 30);
}
