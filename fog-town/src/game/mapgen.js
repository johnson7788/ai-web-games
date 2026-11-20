// FOG TOWN · 街区地图生成（纯逻辑，零依赖，seed 确定性）
// 保证：start→exit/key/lever/clues 在「墙 + 守卫视线」之外仍连通，greedy BFS 必可解。
// 输出 map：{ cells(flat), start, exit, key, lever, clues[], traps[], guards[], danger, par, maxSteps, oil, doorNeeds, clueCount, scene }
import { GRID, T, DIRS, TRUTH, STEPS, OIL } from '../../config/gameplay.js';
import { SCENES } from '../../config/levels.js';
import { randInt } from './rng.js';

const COLS = GRID.COLS;
const ROWS = GRID.ROWS;

function idx(x, y) { return y * COLS + x; }
function coord(i) { return { x: i % COLS, y: Math.floor(i / COLS) }; }
function inb(x, y) { return x >= 0 && x < COLS && y >= 0 && y < ROWS; }

// 门是否已解锁（钥匙 / 机关 / 线索三个条件）
export function doorUnlocked(map, state) {
  const needsKey = map.doorNeeds === 'key' || map.doorNeeds === 'keyAndLever';
  const needsLever = map.doorNeeds === 'lever' || map.doorNeeds === 'keyAndLever';
  const needsClues = (map.clueCount || 0) >= TRUTH.CLUE_TARGET;
  return (!needsKey || (state.keyCollected ?? 0) > 0)
    && (!needsLever || !!state.leverOn)
    && (!needsClues || (state.cluesCollected ?? 0) >= (map.clueCount || 0));
}

// 贪婪策略目标优先级：钥匙 → 机关 → 线索 → 出口（mapgen 与 selfplay 共用同一逻辑）
export function greedyNextTarget(map, state) {
  if (!doorUnlocked(map, state)) {
    const needsKey = map.doorNeeds === 'key' || map.doorNeeds === 'keyAndLever';
    const needsLever = map.doorNeeds === 'lever' || map.doorNeeds === 'keyAndLever';
    const needsClues = (map.clueCount || 0) >= TRUTH.CLUE_TARGET;
    if (needsKey && !((state.keyCollected ?? 0) > 0) && map.key) return map.key;
    if (needsLever && !state.leverOn && map.lever) return map.lever;
    if (needsClues && (state.cluesCollected ?? 0) < (map.clueCount || 0)) {
      let best = null;
      let bd = Infinity;
      for (let i = 0; i < (map.clues || []).length; i += 1) {
        if (state.clueTaken && state.clueTaken[i]) continue;
        const c = map.clues[i];
        const d = Math.abs(c.x - state.player.x) + Math.abs(c.y - state.player.y);
        if (d < bd) { bd = d; best = c; }
      }
      return best;
    }
  }
  return map.exit;
}

function applyCollect(map, state, cell) {
  if (map.key && cell.x === map.key.x && cell.y === map.key.y) state.keyCollected = 1;
  if (map.lever && cell.x === map.lever.x && cell.y === map.lever.y) state.leverOn = true;
  for (let i = 0; i < (map.clues || []).length; i += 1) {
    const c = map.clues[i];
    if (cell.x === c.x && cell.y === c.y && !state.clueTaken[i]) {
      state.clueTaken[i] = true;
      state.cluesCollected += 1;
    }
  }
}

/** BFS 最短路（blocked 为 (i)=>bool）。返回父指针数组 parents（不可达则为 -1）。 */
export function bfsParents(map, from, blocked) {
  const startI = idx(from.x, from.y);
  const parents = new Int32Array(COLS * ROWS).fill(-1);
  const seen = new Uint8Array(COLS * ROWS);
  const q = [startI];
  seen[startI] = 1;
  let head = 0;
  while (head < q.length) {
    const i = q[head++];
    const { x, y } = coord(i);
    for (const d of Object.values(DIRS)) {
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (!inb(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (seen[ni] || blocked(ni)) continue;
      seen[ni] = 1;
      parents[ni] = i;
      q.push(ni);
    }
  }
  return parents;
}

/** 从 parents 反推 from→to 的路径（含起终点）。to 不可达返回 null。 */
export function reconstruct(parents, from, to) {
  const targetI = idx(to.x, to.y);
  if (parents[targetI] === -1) return null;
  const path = [];
  let i = targetI;
  for (;;) {
    path.push(coord(i));
    if (i === idx(from.x, from.y)) break;
    i = parents[i];
    if (i === -1) return null;
  }
  path.reverse();
  return path;
}

export function bfsPath(map, from, to, blocked) {
  return reconstruct(bfsParents(map, from, blocked), from, to);
}

/** 贪婪策略下一步方向（selfplay / main 调试共用）。state 见 greedyNextTarget。 */
export function greedyDir(map, state) {
  const target = greedyNextTarget(map, state);
  if (!target) return null;
  const blocked = (i) => map.cells[i] === T.WALL || map.danger[i] === 1;
  const path = bfsPath(map, state.player, target, blocked);
  if (!path || path.length < 2) return null;
  const next = path[1];
  const dx = next.x - state.player.x;
  const dy = next.y - state.player.y;
  for (const name of Object.keys(DIRS)) {
    const d = DIRS[name];
    if (d.dx === dx && d.dy === dy) return name;
  }
  return null;
}

function manh(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

// 模拟贪婪策略走完全局：返回 { steps, cells:Set<index> }。不可解返回 { steps: Infinity }。
function simulateGreedyPath(map, blocked) {
  const state = {
    player: map.start,
    keyCollected: 0,
    leverOn: false,
    cluesCollected: 0,
    clueTaken: new Array((map.clues || []).length).fill(false),
  };
  const cells = new Set();
  cells.add(idx(map.start.x, map.start.y));
  let steps = 0;
  for (let guard = 0; guard < 500; guard += 1) {
    const target = greedyNextTarget(map, state);
    if (!target) return { steps: Infinity, cells };
    if (state.player.x === target.x && state.player.y === target.y) {
      applyCollect(map, state, target);
      if (target.x === map.exit.x && target.y === map.exit.y) return { steps, cells };
      continue;
    }
    const path = bfsPath(map, state.player, target, blocked);
    if (!path) return { steps: Infinity, cells };
    for (let k = 1; k < path.length; k += 1) {
      state.player = path[k];
      cells.add(idx(state.player.x, state.player.y));
      steps += 1;
    }
    applyCollect(map, state, state.player);
    if (state.player.x === map.exit.x && state.player.y === map.exit.y) return { steps, cells };
  }
  return { steps: Infinity, cells };
}

function blockedFn(cells, danger) {
  return (i) => cells[i] === T.WALL || danger[i] === 1;
}

// 把 cells 里某些墙挖通，让 from 能到达 to（L 形路径）。
function carvePath(cells, from, to) {
  const blocked = (i) => cells[i] === T.WALL;
  const parents = bfsParents({}, from, blocked);
  if (parents[idx(to.x, to.y)] !== -1) return;
  // 找离 to 最近的、从 from 可达的格
  const seen = new Uint8Array(cells.length);
  const reachSet = new Set();
  const q = [idx(from.x, from.y)];
  seen[idx(from.x, from.y)] = 1;
  let h = 0;
  while (h < q.length) {
    const i = q[h++];
    reachSet.add(i);
    const { x, y } = coord(i);
    for (const d of Object.values(DIRS)) {
      const nx = x + d.dx; const ny = y + d.dy;
      if (!inb(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (seen[ni] || cells[ni] === T.WALL) continue;
      seen[ni] = 1; q.push(ni);
    }
  }
  let best = null; let bd = Infinity;
  for (const i of reachSet) {
    const c = coord(i);
    const d = manh(c, to);
    if (d < bd) { bd = d; best = c; }
  }
  if (!best) return;
  let cx = best.x; let cy = best.y;
  while (cx !== to.x) { cx += cx < to.x ? 1 : -1; cells[idx(cx, cy)] = T.FLOOR; }
  while (cy !== to.y) { cy += cy < to.y ? 1 : -1; cells[idx(cx, cy)] = T.FLOOR; }
}

export function genBlock(block, rng) {
  const scene = SCENES[block.scene] || SCENES[0];
  const cells = new Uint8Array(COLS * ROWS); // 默认 FLOOR(0)

  // 1) start / exit 对角（长路径 = 更多决定）
  const start = { x: 1, y: ROWS - 2 };
  const exit = { x: COLS - 2, y: 1 };
  cells[idx(exit.x, exit.y)] = T.EXIT;

  // 2) 关键物件占位
  const reserved = new Set([idx(start.x, start.y), idx(exit.x, exit.y)]);
  const pickInterior = () => {
    for (let a = 0; a < 400; a += 1) {
      const x = randInt(rng, 2, COLS - 3);
      const y = randInt(rng, 2, ROWS - 3);
      const i = idx(x, y);
      if (!reserved.has(i)) { reserved.add(i); return { x, y }; }
    }
    return { x: 2, y: 2 };
  };

  const needsKey = block.doorNeeds === 'key' || block.doorNeeds === 'keyAndLever';
  const needsLever = block.doorNeeds === 'lever' || block.doorNeeds === 'keyAndLever';
  const key = needsKey ? pickInterior() : null;
  const lever = needsLever ? pickInterior() : null;
  const clues = [];
  for (let i = 0; i < (block.clueCount || 0); i += 1) clues.push(pickInterior());
  const traps = [];
  for (let i = 0; i < (block.trapCount || 0); i += 1) traps.push(pickInterior());
  if (key) cells[idx(key.x, key.y)] = T.KEY;
  if (lever) cells[idx(lever.x, lever.y)] = T.LEVER;
  for (const c of clues) cells[idx(c.x, c.y)] = T.CLUE;
  for (const t of traps) cells[idx(t.x, t.y)] = T.TRAP;

  // 3) 墙（跳过 reserved + start/exit 邻域）
  const layoutMult = block.layout === 'dense' ? 1.35 : block.layout === 'corridor' ? 1.05 : 0.8;
  const wallTarget = Math.round(COLS * ROWS * (scene.walls || 0.16) * layoutMult);
  const wallOk = (x, y) => {
    const i = idx(x, y);
    if (reserved.has(i) || cells[i] !== T.FLOOR) return false;
    const nearStart = Math.abs(x - start.x) <= 1 && Math.abs(y - start.y) <= 1;
    const nearExit = Math.abs(x - exit.x) <= 1 && Math.abs(y - exit.y) <= 1;
    return !nearStart && !nearExit;
  };
  let placedWalls = 0;
  for (let a = 0; a < wallTarget * 40 && placedWalls < wallTarget; a += 1) {
    const x = randInt(rng, 1, COLS - 2);
    const y = randInt(rng, 1, ROWS - 2);
    if (wallOk(x, y)) { cells[idx(x, y)] = T.WALL; placedWalls += 1; }
  }

  // 挖通关键路径（墙不挡任何目标）
  carvePath(cells, start, exit);
  if (key) carvePath(cells, start, key);
  if (lever) carvePath(cells, start, lever);
  for (const c of clues) carvePath(cells, start, c);

  // 4) 无守卫时的贪婪路径（用于守卫避让 + par）
  const mapBase = { start, exit, key, lever, clues, doorNeeds: block.doorNeeds, clueCount: block.clueCount || 0 };
  const emptyDanger = new Uint8Array(COLS * ROWS);
  const blockedNoGuard = blockedFn(cells, emptyDanger);
  const base = simulateGreedyPath(mapBase, blockedNoGuard);

  // 5) 守卫：守卫格 + 视线格都不得落在贪婪路径上
  const guards = [];
  for (let i = 0; i < (block.guardCount || 0); i += 1) {
    for (let a = 0; a < 800; a += 1) {
      const x = randInt(rng, 2, COLS - 3);
      const y = randInt(rng, 2, ROWS - 3);
      const gi = idx(x, y);
      if (reserved.has(gi) || cells[gi] !== T.FLOOR) continue;
      if (base.cells.has(gi)) continue;
      const dir = ['up', 'down', 'left', 'right'][randInt(rng, 0, 3)];
      const d = DIRS[dir];
      const nx = x + d.dx; const ny = y + d.dy;
      if (inb(nx, ny) && base.cells.has(idx(nx, ny))) continue;
      guards.push({ x, y, dir });
      reserved.add(gi);
      break;
    }
  }

  const danger = new Uint8Array(COLS * ROWS);
  for (const g of guards) {
    danger[idx(g.x, g.y)] = 1;
    const d = DIRS[g.dir] || DIRS.up;
    const nx = g.x + d.dx; const ny = g.y + d.dy;
    if (inb(nx, ny)) danger[idx(nx, ny)] = 1;
  }
  const blocked = blockedFn(cells, danger);

  // 6) 最终 par（守卫避开了路径，par 不变；若守卫意外影响则回退）
  const finalPath = simulateGreedyPath(mapBase, blocked);
  let par = Number.isFinite(finalPath.steps) ? finalPath.steps : base.steps;
  if (!Number.isFinite(par) || par <= 0) par = manh(start, exit) + 4;

  const maxSteps = Math.ceil(par * STEPS.MAX_MULT) + STEPS.SLACK;
  const oil = Math.max(4, Math.ceil(par * OIL.BASE_MULT) + OIL.BASE_ADD);

  return {
    cols: COLS,
    rows: ROWS,
    cells,
    start,
    exit,
    key,
    lever,
    clues,
    traps,
    guards,
    danger,
    par,
    maxSteps,
    oil,
    doorNeeds: block.doorNeeds,
    clueCount: block.clueCount || 0,
    scene: block.scene,
  };
}
