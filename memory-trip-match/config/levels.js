// MEMORY TRIP MATCH · 关卡数据（20 关，P0 1:1 复刻参考 count 3→22 的推进）
// 字段：pairs=配对数 / previewSec=开局记忆预览秒数 / rockPairs=岩石卡配对数 /
//       moveBudget=步数预算（耗尽判负）/ newElement=本关新元素。
// 网格：cols×rows 由总卡数自动推导（宽优先，贴近 16:9）。

function gridFor(total) {
  const cols = Math.ceil(Math.sqrt(total * 1.7));
  const rows = Math.ceil(total / cols);
  return { cols, rows };
}

function rockPairsFor(level) {
  // 第 5 关起引入岩石卡，之后每 3 关 +1，封顶 4 对岩石
  if (level < 5) return 0;
  return Math.min(1 + Math.floor((level - 5) / 3), 4);
}

function previewSecFor(pairs) {
  return Math.max(1.5, Math.min(5, 0.6 + pairs * 0.35));
}

const NEW_ELEMENTS = [
  '3 对卡 · 6 张：学会翻牌配对',
  '4 对卡 · 8 张：步数开始计星',
  '5 对卡 · 10 张：连击计分登场',
  '6 对卡 · 12 张：更宽的 5×3 网格',
  '7 对卡：岩石卡（要先敲裂才能翻开）',
  '8 对卡：岩石卡增至 1 对',
  '9 对卡：预算收紧，少走弯路',
  '10 对卡：岩石卡增至 2 对',
  '11 对卡：长棋盘，记忆压力拉满',
  '12 对卡：连击收益更值钱',
  '13 对卡：岩石卡增至 3 对',
  '14 对卡：三列窄卡，剪影要认准',
  '15 对卡：更大预览窗结束',
  '16 对卡：岩石卡封顶 4 对',
  '17 对卡：纯记忆的极限',
  '18 对卡：步数预算最难的一档',
  '19 对卡：接近终章的牌海',
  '20 对卡：终章 44 张牌大巡游',
  '21 对卡：隐藏加演关',
  '22 对卡：传奇终点站',
];

export const LEVEL_COUNT = 20;
export const LEVELS = [];
for (let i = 1; i <= LEVEL_COUNT; i += 1) {
  const pairs = i + 2; // 3 → 22，逐关 +1（复刻参考 count 曲线）
  const total = pairs * 2;
  const rockPairs = rockPairsFor(i);
  const { cols, rows } = gridFor(total);
  LEVELS.push({
    index: i,
    pairs,
    totalCards: total,
    cols,
    rows,
    previewSec: Number(previewSecFor(pairs).toFixed(2)),
    mismatchDelay: 1.5,
    rockPairs,
    hints: 2,
    moveBudget: pairs * 3,
    newElement: NEW_ELEMENTS[Math.min(i - 1, NEW_ELEMENTS.length - 1)],
  });
}

export function levelFor(index) {
  return LEVELS[Math.max(0, Math.min(LEVEL_COUNT - 1, index | 0))];
}
