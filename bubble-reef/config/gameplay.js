// config/gameplay.js — 泡泡龙核心数值与六边形网格几何（纯逻辑，无 DOM）
// 坐标系：横屏 1280×720；网格在顶部（row 0 = 顶行），炮台在底部中心，向上发射。
//
// 关键：每一行都自带 parity（0 = 偶数行左对齐，1 = 奇数行右移半格），而不是用 row%2。
// 这样「顶棚下沉一行」只需要在顶部 unshift 一行翻转 parity 的新行，既有行保持自身
// parity 与格子不变，邻接关系不被破坏，物理上表现为整场泡泡竖直下移一行。

export const WORLD = { WIDTH: 1280, HEIGHT: 720 };

export const BUBBLE_R = 24;                                    // 泡泡半径（世界单位）
export const BUBBLE_DIAM = BUBBLE_R * 2;                       // 直径（碰撞判定距离）
export const COLS = 13;                                        // parity 0 行的列数（parity 1 行少 1 列）
export const ROW_SPACING = BUBBLE_DIAM * (Math.sqrt(3) / 2);   // 行间距 ≈ 41.57
export const X0 = Math.round((WORLD.WIDTH - COLS * BUBBLE_DIAM) / 2); // 网格左缘 = 328
export const TOP_Y = 56;                                       // 顶行中心 y = TOP_Y + R
export const DEATH_Y = 580;                                    // 触底判负线（泡泡中心 y 达到即判负）
export const SHOOTER = { x: WORLD.WIDTH / 2, y: 660 };         // 炮台位置
export const SHOT_SPEED = 900;                                 // 弹丸速度 px/s
export const MAX_AIM = (75 * Math.PI) / 180;                   // 最大仰角（±75°）
export const WILDCARD_COMBO = 3;                               // 攒满 3 连击 → 可换 1 颗百搭泡
export const PREVIEWS_PER_LEVEL = 1;                           // 每关 1 次免费潮汐瞄准线

/** 该 parity 行有多少列（0 → COLS，1 → COLS-1） */
export function colsInRow(parity) {
  return parity === 0 ? COLS : COLS - 1;
}

/** 该 parity 行第 col 列的屏幕 x */
export function rowX(parity, col) {
  return X0 + BUBBLE_R * (parity + 1) + col * BUBBLE_DIAM;
}

/** 该行索引的屏幕 y */
export function rowY(row) {
  return TOP_Y + BUBBLE_R + row * ROW_SPACING;
}

/** (parity, row, col) → 屏幕坐标（中心点） */
export function rowColToPos(parity, row, col) {
  return { x: rowX(parity, col), y: rowY(row) };
}

/** 屏幕 y → 最近行索引 */
export function rowIndexFromY(y) {
  return Math.round((y - TOP_Y - BUBBLE_R) / ROW_SPACING);
}

/** 屏幕 x + 行 parity → 最近列索引 */
export function colFromX(x, parity) {
  return Math.round((x - X0 - BUBBLE_R * (parity + 1)) / BUBBLE_DIAM);
}

/**
 * 六邻域偏移（相对自身）。入参是「自身所在行」的 parity。
 * 返回 [dRow, dCol] 增量数组，与源码 BubbleMgr 的六向检测一致。
 */
export function neighborsOf(parity) {
  const dl = parity === 0 ? -1 : 0;  // 下/上-左 的列偏移
  const dr = parity === 0 ? 0 : 1;   // 下/上-右 的列偏移
  return [
    [-1, dl], [-1, dr],
    [0, -1], [0, 1],
    [1, dl], [1, dr],
  ];
}

/** 行 parity 查询：越界未建行时按 row%2 兜底（新行从顶加，初始即交错） */
export function parityOf(parities, row) {
  if (row >= 0 && row < parities.length) return parities[row];
  return ((row % 2) + 2) % 2;
}
