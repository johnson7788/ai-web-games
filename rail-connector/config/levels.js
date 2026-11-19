// levels.js — 原创关卡数据（纯数据 + 一个程序化闭环生成器，零外链零素材）。
//
// 每关 = 红/蓝两条互不相交或受控交叉的「霓虹回路」。火车沿回路自动行驶；
// 玩家切换开关(switch)把火车从「错路/死路」改回正确回路，让其拾取对应颜色的
// 能量核心(cargo)并送到同色终端(terminal)。填满进度条即过关。
//
// 生成器保证：loop 上的每个瓦片都按「进入方向→离开方向」推导出正确直线/弯道，
// 因此回路永远首尾连通（开关为「错路=拐进死路」/「正确=回路直行」两态）。

import { tileFor, dirBetween, E, W, N, S, DX, DY, opposite } from '../src/game/track.js';

// 顺时针矩形回环（含四角），起点左上角向右。
function rectLoop(r0, c0, r1, c1) {
  const cells = [];
  for (let c = c0; c <= c1; c += 1) cells.push([r0, c]);
  for (let r = r0 + 1; r <= r1; r += 1) cells.push([r, c1]);
  for (let c = c1 - 1; c >= c0; c -= 1) cells.push([r1, c]);
  for (let r = r1 - 1; r >= r0 + 1; r -= 1) cells.push([r, c0]);
  return cells;
}

const key = (r, c) => `${r},${c}`;

function buildLoop(cells) {
  const dirs = new Map();
  const tiles = new Map();
  const n = cells.length;
  for (let i = 0; i < n; i += 1) {
    const prev = cells[(i - 1 + n) % n];
    const cur = cells[i];
    const next = cells[(i + 1) % n];
    const entry = dirBetween(cur, prev); // 进入端口（指向上一格）
    const to = dirBetween(cur, next);    // 离开端口（指向下一格）
    dirs.set(key(cur[0], cur[1]), { from: entry, to });
    tiles.set(key(cur[0], cur[1]), tileFor(entry, to));
  }
  return { dirs, tiles, cells };
}

function makeLevel(spec) {
  const { rows, cols } = spec;
  const grid = [];
  for (let r = 0; r < rows; r += 1) {
    const row = [];
    for (let c = 0; c < cols; c += 1) row.push({ type: 'empty' });
    grid.push(row);
  }

  const trackCells = new Set(); // 所有回路占用的格子
  const loops = {};
  const trains = [];
  const cargos = [];
  const terminals = [];

  for (const color of ['red', 'blue']) {
    const rect = spec[color];
    const cells = rectLoop(rect[0], rect[1], rect[2], rect[3]);
    const built = buildLoop(cells);
    loops[color] = built;
    for (const [k, tile] of built.tiles) {
      const [r, c] = k.split(',').map(Number);
      grid[r][c] = { type: tile.kind, rot: tile.rot };
      trackCells.add(k);
    }
    const start = cells[0];
    const next = cells[1];
    trains.push({ color, r: start[0], c: start[1], dir: dirBetween(start, next) });
    cargos.push({ color, r: spec[`${color}Cargo`][0], c: spec[`${color}Cargo`][1] });
    terminals.push({ color, r: spec[`${color}Terminal`][0], c: spec[`${color}Terminal`][1] });
  }

  const switches = [];
  for (const sw of spec.switches || []) {
    const [r, c] = sw.at;
    const k = key(r, c);
    const info = loops.red.dirs.get(k) || loops.blue.dirs.get(k);
    if (!info) throw new Error(`开关 ${k} 不在回路上`);
    const { from, to } = info;
    const correct = loops.red.tiles.get(k) || loops.blue.tiles.get(k);
    // 找一条「离路方向」：与 from/to 不同、且邻居为空（指向死路）。
    let stubDir = null;
    for (let d = 0; d < 4; d += 1) {
      if (d === from || d === to) continue;
      const nr = r + DY[d];
      const nc = c + DX[d];
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (!trackCells.has(key(nr, nc))) { stubDir = d; break; }
    }
    if (stubDir == null) throw new Error(`开关 ${k} 找不到死路方向`);
    const wrong = tileFor(from, stubDir); // 拐进死路（直线段则必为弯道）
    grid[r][c] = {
      type: 'switch',
      states: [wrong, correct],
      stateIndex: 0, // 默认「错路」→ 玩家必须动手
    };
    switches.push({ r, c, states: [wrong, correct], stateIndex: 0 });
  }

  for (const rock of spec.rocks || []) {
    grid[rock[0]][rock[1]] = { type: 'rock' };
  }

  return {
    id: spec.id,
    name: spec.name,
    rows,
    cols,
    grid,
    switches,
    trains,
    cargos,
    terminals,
    rocks: spec.rocks || [],
    timeLimit: spec.timeLimit,
    totalScore: spec.totalScore,
    speed: spec.speed,
    goodsScore: spec.goodsScore,
    errorScore: spec.errorScore,
    trainCount: spec.trainCount || 2,
    frostCharges: spec.frostCharges || 1,
  };
}

const L = (spec) => makeLevel(spec);

export const LEVELS = [
  // L1：1 个开关，双独立回路，教学关。
  L({
    id: 0, name: { en: 'First Switch', zh: '第一枚道岔' },
    rows: 9, cols: 10,
    red: [0, 0, 3, 4], blue: [5, 5, 8, 9],
    redCargo: [0, 3], redTerminal: [3, 2],
    blueCargo: [5, 8], blueTerminal: [8, 6],
    switches: [{ at: [0, 2] }, { at: [5, 7] }],
    timeLimit: 60, totalScore: 40, speed: 1.4, goodsScore: 20, errorScore: 5, trainCount: 2,
  }),
  // L2：2 开关（红 1 蓝 1，更大回路）。
  L({
    id: 1, name: { en: 'Twin Loops', zh: '双环线' },
    rows: 11, cols: 11,
    red: [0, 0, 4, 4], blue: [6, 6, 10, 10],
    redCargo: [0, 3], redTerminal: [4, 1],
    blueCargo: [6, 9], blueTerminal: [10, 7],
    switches: [{ at: [0, 2] }, { at: [6, 8] }],
    timeLimit: 70, totalScore: 60, speed: 1.6, goodsScore: 20, errorScore: 6, trainCount: 2,
  }),
  // L3：3 开关，稍快，要求 3 次投递。
  L({
    id: 2, name: { en: 'Triple Junction', zh: '三岔口' },
    rows: 11, cols: 12,
    red: [0, 0, 4, 5], blue: [6, 6, 10, 11],
    redCargo: [4, 2], redTerminal: [0, 4],
    blueCargo: [6, 10], blueTerminal: [10, 7],
    switches: [{ at: [0, 2] }, { at: [4, 3] }, { at: [6, 8] }],
    timeLimit: 80, totalScore: 60, speed: 1.8, goodsScore: 20, errorScore: 8, trainCount: 3,
  }),
  // L4：岩石关——错路上有岩石，撞上直接碎石崩车。
  L({
    id: 3, name: { en: 'Rockfall', zh: '落石区' },
    rows: 12, cols: 12,
    red: [1, 1, 5, 6], blue: [6, 6, 11, 11],
    redCargo: [1, 5], redTerminal: [5, 2],
    blueCargo: [6, 10], blueTerminal: [11, 7],
    switches: [{ at: [1, 3] }, { at: [6, 8] }],
    rocks: [[2, 3], [7, 8]],
    timeLimit: 80, totalScore: 60, speed: 1.8, goodsScore: 20, errorScore: 8, trainCount: 3,
  }),
  // L5：交叉关——红蓝共享一段，错路会让两车相撞。
  L({
    id: 4, name: { en: 'Crash Crossing', zh: '交叉对撞' },
    rows: 12, cols: 12,
    red: [0, 0, 5, 11], blue: [6, 0, 11, 11],
    redCargo: [0, 5], redTerminal: [5, 6],
    blueCargo: [11, 5], blueTerminal: [6, 6],
    switches: [{ at: [0, 3] }, { at: [5, 3] }, { at: [6, 8] }, { at: [11, 8] }],
    timeLimit: 90, totalScore: 80, speed: 2.0, goodsScore: 20, errorScore: 10, trainCount: 3,
  }),
  // L6-L12：逐步提速、加开关、加岩石（结构相同，节奏更快）。
  L({
    id: 5, name: { en: 'Rush Hour', zh: '高峰时刻' },
    rows: 12, cols: 12,
    red: [1, 1, 5, 6], blue: [6, 6, 11, 11],
    redCargo: [5, 3], redTerminal: [1, 5],
    blueCargo: [11, 7], blueTerminal: [6, 10],
    switches: [{ at: [1, 3] }, { at: [5, 4] }, { at: [6, 8] }],
    rocks: [[2, 3]],
    timeLimit: 75, totalScore: 80, speed: 2.1, goodsScore: 20, errorScore: 10, trainCount: 3,
  }),
  L({
    id: 6, name: { en: 'Night Grid', zh: '夜行网格' },
    rows: 13, cols: 13,
    red: [0, 0, 5, 6], blue: [7, 7, 12, 12],
    redCargo: [5, 2], redTerminal: [0, 5],
    blueCargo: [12, 8], blueTerminal: [7, 11],
    switches: [{ at: [0, 3] }, { at: [5, 4] }, { at: [7, 9] }],
    rocks: [[3, 3], [10, 9]],
    timeLimit: 80, totalScore: 80, speed: 2.2, goodsScore: 20, errorScore: 12, trainCount: 3,
  }),
  L({
    id: 7, name: { en: 'Twin Trains', zh: '双车并行' },
    rows: 13, cols: 13,
    red: [0, 0, 5, 6], blue: [7, 7, 12, 12],
    redCargo: [0, 4], redTerminal: [5, 3],
    blueCargo: [7, 10], blueTerminal: [12, 8],
    switches: [{ at: [0, 2] }, { at: [5, 3] }, { at: [7, 9] }, { at: [12, 9] }],
    timeLimit: 85, totalScore: 100, speed: 2.2, goodsScore: 25, errorScore: 12, trainCount: 3,
  }),
  L({
    id: 8, name: { en: 'Boulder Dash', zh: '巨石冲刺' },
    rows: 14, cols: 13,
    red: [1, 1, 6, 6], blue: [7, 7, 13, 12],
    redCargo: [6, 3], redTerminal: [1, 5],
    blueCargo: [7, 11], blueTerminal: [13, 8],
    switches: [{ at: [1, 3] }, { at: [6, 4] }, { at: [7, 9] }],
    rocks: [[2, 3], [8, 9], [12, 9]],
    timeLimit: 85, totalScore: 100, speed: 2.3, goodsScore: 25, errorScore: 14, trainCount: 3,
  }),
  L({
    id: 9, name: { en: 'Overload', zh: '超载' },
    rows: 14, cols: 14,
    red: [0, 0, 6, 6], blue: [7, 7, 13, 13],
    redCargo: [6, 2], redTerminal: [0, 5],
    blueCargo: [13, 9], blueTerminal: [7, 12],
    switches: [{ at: [0, 3] }, { at: [6, 4] }, { at: [7, 9] }, { at: [13, 9] }],
    timeLimit: 90, totalScore: 120, speed: 2.4, goodsScore: 30, errorScore: 15, trainCount: 3,
  }),
  L({
    id: 10, name: { en: 'Frost Circuit', zh: '霜冻回路' },
    rows: 14, cols: 14,
    red: [0, 0, 6, 6], blue: [7, 7, 13, 13],
    redCargo: [0, 4], redTerminal: [6, 3],
    blueCargo: [7, 10], blueTerminal: [13, 8],
    switches: [{ at: [0, 2] }, { at: [6, 3] }, { at: [7, 9] }, { at: [13, 9] }],
    rocks: [[3, 3], [10, 10]],
    timeLimit: 90, totalScore: 120, speed: 2.5, goodsScore: 30, errorScore: 15, trainCount: 3,
  }),
  L({
    id: 11, name: { en: 'Final Mile', zh: '最后一程' },
    rows: 15, cols: 15,
    red: [1, 1, 7, 7], blue: [8, 8, 14, 14],
    redCargo: [7, 3], redTerminal: [1, 6],
    blueCargo: [14, 9], blueTerminal: [8, 13],
    switches: [{ at: [1, 3] }, { at: [7, 4] }, { at: [8, 9] }, { at: [14, 9] }],
    rocks: [[2, 3], [9, 9], [13, 9]],
    timeLimit: 100, totalScore: 140, speed: 2.6, goodsScore: 35, errorScore: 20, trainCount: 3,
  }),
];

export const LEVEL_COUNT = LEVELS.length;
