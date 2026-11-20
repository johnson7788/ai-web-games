// config/levels.js — 12 关推进结构（每关一个新元素，三场景包：浅礁/夜礁/沉船）
// 字段：
//   colors      本关颜色数（4 或 5）
//   rows        初始填充行数（从顶部往下）
//   clearance   通关所需清除率（已消除泡泡 / 总泡泡）
//   shotsToSink 每多少发顶棚下沉一行
//   rocks       岩礁障碍泡数量（不可消，只能靠掉落清除）
//   drift       洋流横向偏移速度（px/s，弹道偏移）
//   doubleCeil  双层顶棚：每轮下沉两行
//   gold        金泡数量（通关必须清光金泡）
//   pack        场景包：shallow | night | wreck
export const LEVELS = [
  { index: 1,  colors: 4, rows: 6,  clearance: 0.70, shotsToSink: 12, rocks: 0, drift: 0,  doubleCeil: false, gold: 0, pack: 'shallow' },
  { index: 2,  colors: 4, rows: 7,  clearance: 0.72, shotsToSink: 12, rocks: 6, drift: 0,  doubleCeil: false, gold: 0, pack: 'shallow' },
  { index: 3,  colors: 4, rows: 7,  clearance: 0.74, shotsToSink: 11, rocks: 2, drift: 40, doubleCeil: false, gold: 0, pack: 'shallow' },
  { index: 4,  colors: 4, rows: 8,  clearance: 0.76, shotsToSink: 11, rocks: 4, drift: 0,  doubleCeil: true,  gold: 0, pack: 'shallow' },
  { index: 5,  colors: 4, rows: 8,  clearance: 0.76, shotsToSink: 11, rocks: 0, drift: 0,  doubleCeil: false, gold: 0, pack: 'night' },
  { index: 6,  colors: 4, rows: 8,  clearance: 0.78, shotsToSink: 10, rocks: 2, drift: 0,  doubleCeil: false, gold: 3, pack: 'night' },
  { index: 7,  colors: 5, rows: 8,  clearance: 0.78, shotsToSink: 10, rocks: 0, drift: 0,  doubleCeil: false, gold: 0, pack: 'night' },
  { index: 8,  colors: 5, rows: 9,  clearance: 0.80, shotsToSink: 10, rocks: 3, drift: 80, doubleCeil: false, gold: 0, pack: 'night' },
  { index: 9,  colors: 4, rows: 9,  clearance: 0.80, shotsToSink: 10, rocks: 0, drift: 0,  doubleCeil: false, gold: 0, pack: 'wreck' },
  { index: 10, colors: 4, rows: 9,  clearance: 0.82, shotsToSink: 9,  rocks: 8, drift: 0,  doubleCeil: false, gold: 0, pack: 'wreck' },
  { index: 11, colors: 5, rows: 10, clearance: 0.84, shotsToSink: 9,  rocks: 4, drift: 0,  doubleCeil: true,  gold: 0, pack: 'wreck' },
  { index: 12, colors: 5, rows: 10, clearance: 0.95, shotsToSink: 8,  rocks: 4, drift: 40, doubleCeil: false, gold: 4, pack: 'wreck' },
];

export function levelAt(index) {
  const i = Math.max(0, Math.min(LEVELS.length - 1, (index || 1) - 1));
  return LEVELS[i];
}
