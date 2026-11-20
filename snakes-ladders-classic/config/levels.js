// 棋盘关卡定义：48 格（0-47），0=起点 47=终点，蛇形（boustrophedon）编号。
// 事件格：ladder 上爬 / snake 下滑 / rock 眩晕跳过下回合 / gem 收集+前进一步 / tree 装饰空事件。
export const BOARD = { COLS: 8, ROWS: 6, CELLS: 48, MAX: 47 };

function buildEvents({ ladders, snakes, rocks, gems, tree }) {
  const events = {};
  for (const k of Object.keys(ladders)) events[k] = { type: 'ladder', to: ladders[k] };
  for (const k of Object.keys(snakes)) events[k] = { type: 'snake', to: snakes[k] };
  for (const c of rocks) events[c] = { type: 'rock', to: c };
  for (const c of gems) events[c] = { type: 'gem', to: c + 1 };
  if (tree != null) events[tree] = { type: 'tree', to: tree };
  events[0] = { type: 'start', to: 0 };
  return events;
}

const LADDERS = { 3: 14, 8: 30, 16: 34, 28: 42 };
const SNAKES = { 17: 4, 21: 2, 33: 15, 45: 26 };

export const LEVELS = [
  {
    index: 0,
    name: 'neon-start',
    combo: false,                      // 幸运 6 连击（第 3 关开放）
    ladders: LADDERS,
    snakes: SNAKES,
    rocks: [],
    gems: [],
    tree: 1,
  },
  {
    index: 1,
    name: 'rock-canyon',
    combo: false,
    ladders: LADDERS,
    snakes: SNAKES,
    rocks: [6, 24, 38],
    gems: [],
    tree: 1,
  },
  {
    index: 2,
    name: 'star-run',
    combo: true,
    ladders: LADDERS,
    snakes: SNAKES,
    rocks: [6, 24, 38],
    gems: [12, 22, 36, 43],
    tree: 1,
  },
].map((lv) => ({ ...lv, events: buildEvents(lv) }));

// 格子编号 → (行, 列)。row 0 在底部，col 0 在左侧；蛇形路径左右交替。
export function cellToRC(cell) {
  const r = Math.floor(cell / BOARD.COLS);
  const c0 = cell % BOARD.COLS;
  const col = r % 2 === 0 ? c0 : BOARD.COLS - 1 - c0;
  return { r, col };
}
