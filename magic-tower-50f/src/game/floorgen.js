// 程序化楼层生成（确定性，seeded）：0 层基地 / 1-49 迷宫 / 50 层 boss 决战。
// 纯逻辑零 DOM。关键路径（出生点→楼梯）永不要求钥匙/推石头；钥匙门与机关石只放侧支路。

import { GAME } from '../../config/game.config.js';
import { monsterStats, MONSTER_NAMES, BOSS_NAME, mulberry32, pick } from './data.js';
import { findPath } from './astar.js';

export const FLOOR_ROWS = 9;
export const FLOOR_COLS = 13;

function emptyGrid(rows, cols) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 'wall'));
}

function keyOf(r, c) { return `${r},${c}`; }

// ---- 0 层：基地 ----
function homeFloor() {
  const rows = 5;
  const cols = 7;
  const grid = emptyGrid(rows, cols);
  for (let r = 1; r < rows - 1; r += 1) {
    for (let c = 1; c < cols - 1; c += 1) grid[r][c] = 'floor';
  }
  const entities = {};
  const spawn = { r: 3, c: 3 };
  entities[keyOf(1, 1)] = { kind: 'npc', role: 'quest' };
  entities[keyOf(1, 5)] = { kind: 'npc', role: 'shop' };
  entities[keyOf(1, 3)] = { kind: 'stairs', dir: 'up' };
  return { id: 0, rows, cols, grid, entities, spawn, stairsUp: { r: 1, c: 3 }, stairsDown: null, boss: false };
}

// ---- 50 层：boss 决战 ----
function bossFloor(rng) {
  const rows = 11;
  const cols = 11;
  const grid = emptyGrid(rows, cols);
  for (let r = 1; r < rows - 1; r += 1) {
    for (let c = 1; c < cols - 1; c += 1) grid[r][c] = 'floor';
  }
  // 少量装饰墙
  for (let i = 0; i < 8; i += 1) {
    const r = 1 + Math.floor(rng() * (rows - 2));
    const c = 1 + Math.floor(rng() * (cols - 2));
    grid[r][c] = 'wall';
  }
  const spawn = { r: rows - 2, c: Math.floor(cols / 2) };
  const center = { r: Math.floor(rows / 2), c: Math.floor(cols / 2) };
  grid[spawn.r][spawn.c] = 'floor';
  grid[center.r][center.c] = 'floor';
  grid[center.r][center.c + 1] = 'floor';

  const stats = monsterStats(50, 'boss');
  const entities = {};
  entities[keyOf(center.r, center.c)] = {
    kind: 'monster', tier: 'boss', name: BOSS_NAME, maxHp: stats.hp,
    hp: stats.hp, atk: stats.atk, def: stats.def, exp: stats.exp, gold: stats.gold, miss: stats.miss,
  };
  entities[keyOf(center.r, center.c + 1)] = { kind: 'core' };
  entities[keyOf(spawn.r, spawn.c)] = { kind: 'stairs', dir: 'down' };
  return {
    id: 50, rows, cols, grid, entities, spawn,
    stairsUp: null, stairsDown: spawn, boss: true,
  };
}

// ---- 1-49 层：迷宫 ----
function mazeFloor(id, rng) {
  const rows = FLOOR_ROWS;
  const cols = FLOOR_COLS;
  const grid = emptyGrid(rows, cols);

  // 房间格（奇数坐标）
  const roomCells = [];
  for (let r = 1; r < rows - 1; r += 2) {
    for (let c = 1; c < cols - 1; c += 2) roomCells.push({ r, c });
  }
  for (const { r, c } of roomCells) grid[r][c] = 'floor';

  // DFS 生成完美迷宫
  const visited = new Set();
  const stack = [];
  const start = roomCells[Math.floor(rng() * roomCells.length)];
  visited.add(keyOf(start.r, start.c));
  stack.push(start);
  const dirs = [[-2, 0], [2, 0], [0, -2], [0, 2]];
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const neighbors = dirs
      .map(([dr, dc]) => ({ r: cur.r + dr, c: cur.c + dc }))
      .filter((n) => n.r >= 1 && n.r < rows - 1 && n.c >= 1 && n.c < cols - 1)
      .filter((n) => !visited.has(keyOf(n.r, n.c)));
    if (!neighbors.length) { stack.pop(); continue; }
    const next = neighbors[Math.floor(rng() * neighbors.length)];
    visited.add(keyOf(next.r, next.c));
    grid[(cur.r + next.r) / 2][(cur.c + next.c) / 2] = 'floor';
    stack.push(next);
  }

  // 额外开口形成环路
  for (let r = 1; r < rows - 1; r += 1) {
    for (let c = 1; c < cols - 1; c += 1) {
      if (grid[r][c] === 'wall' && rng() < 0.28) grid[r][c] = 'floor';
    }
  }

  const floorCells = [];
  for (let r = 1; r < rows - 1; r += 1) {
    for (let c = 1; c < cols - 1; c += 1) if (grid[r][c] === 'floor') floorCells.push({ r, c });
  }

  // 出生点（左下区）与上楼梯（右上区）
  const bottom = floorCells.filter((p) => p.r >= rows - 3).sort((a, b) => a.c - b.c);
  const top = floorCells.filter((p) => p.r <= 2).sort((a, b) => b.c - a.c);
  const spawn = bottom[0] || floorCells[0];
  const up = top[0] || floorCells[floorCells.length - 1];
  const down = (spawn.r !== up.r || spawn.c !== up.c) ? spawn : bottom[1] || floorCells[1] || floorCells[0];

  const entities = {};
  entities[keyOf(up.r, up.c)] = { kind: 'stairs', dir: 'up' };
  entities[keyOf(down.r, down.c)] = { kind: 'stairs', dir: 'down' };

  const isBlockedCell = (r, c) => grid[r][c] !== 'floor' || !!entities[keyOf(r, c)];
  // 关键路径（不含实体，纯地板）
  const path = findPath(rows, cols, spawn, up, (r, c) => grid[r][c] !== 'floor');
  const pathSet = new Set(path.map((p) => keyOf(p.r, p.c)));
  pathSet.delete(keyOf(spawn.r, spawn.c));
  pathSet.delete(keyOf(up.r, up.c));

  const freeCells = floorCells.filter((p) => {
    const k = keyOf(p.r, p.c);
    return k !== keyOf(spawn.r, spawn.c) && k !== keyOf(up.r, up.c) && k !== keyOf(down.r, down.c);
  });

  const rndCell = (pred) => {
    const cands = freeCells.filter(pred);
    if (!cands.length) return null;
    return cands[Math.floor(rng() * cands.length)];
  };

  const place = (cell, ent) => {
    if (!cell) return false;
    entities[keyOf(cell.r, cell.c)] = ent;
    const idx = freeCells.findIndex((p) => p.r === cell.r && p.c === cell.c);
    if (idx >= 0) freeCells.splice(idx, 1);
    return true;
  };

  // 机关石侧支路（f>=4）：open → rock → pit → gem 死胡同
  if (id >= 4) placeRockPocket(grid, entities, freeCells, rng, id);

  // 怪物：多数放路径外，少数放路径上（保证可清）
  const monsterCount = Math.min(3 + Math.floor(id / 2), Math.floor(freeCells.length * 0.5));
  let onPathBudget = Math.ceil(monsterCount * 0.35);
  for (let i = 0; i < monsterCount; i += 1) {
    const usePath = onPathBudget > 0 && rng() < 0.5;
    const cell = usePath
      ? rndCell((p) => pathSet.has(keyOf(p.r, p.c)))
      : rndCell((p) => !pathSet.has(keyOf(p.r, p.c)));
    if (!cell) {
      const any = rndCell(() => true);
      if (!any) break;
      place(any, makeMonster(id, 'normal', rng));
      continue;
    }
    if (usePath) onPathBudget -= 1;
    place(cell, makeMonster(id, 'normal', rng));
  }
  // 精英怪每 5 层一只（路径外）
  if (id % 5 === 0 && id < 50) {
    const elite = rndCell((p) => !pathSet.has(keyOf(p.r, p.c)));
    place(elite, makeMonster(id, 'elite', rng));
  }

  // 道具
  const scatter = (count, id) => {
    for (let i = 0; i < count; i += 1) place(rndCell(() => true), { kind: 'item', id });
  };
  scatter(1 + (id % 2 === 0 ? 1 : 0), 'gem_atk');
  scatter(1 + (id % 3 === 0 ? 1 : 0), 'gem_def');
  scatter(1 + (id % 4 === 0 ? 1 : 0), 'potion_small');
  if (id % 5 === 0) scatter(1, 'potion_large');
  scatter(1, 'key_yellow');
  if (id % 2 === 0) scatter(1, 'key_blue');
  if (id % 4 === 0) scatter(1, 'key_red');
  scatter(id % 3 === 0 ? 2 : 1, id % 2 === 0 ? 'stone_sword' : 'stone_shield');
  if (id % 10 === 0) scatter(1, 'cross');
  if ([7, 17, 27, 37, 45].includes(id)) scatter(1, 'scroll_teleport');

  // 装备掉落（进阶）
  const SWORD_FLOORS = { 3: 'sword_1', 8: 'sword_2', 14: 'sword_3', 21: 'sword_4', 29: 'sword_5', 38: 'sword_6' };
  const SHIELD_FLOORS = { 4: 'shield_1', 10: 'shield_2', 16: 'shield_3', 24: 'shield_4', 32: 'shield_5', 41: 'shield_6' };
  if (SWORD_FLOORS[id]) scatter(1, SWORD_FLOORS[id]);
  if (SHIELD_FLOORS[id]) scatter(1, SHIELD_FLOORS[id]);

  // 钥匙门（侧支路宝藏）
  if (id >= 2) placeDoors(grid, entities, freeCells, rng, id);

  // 保证出生点可达上楼梯：移除挡路怪
  ensureReachable(grid, entities, rows, cols, spawn, up);

  return { id, rows, cols, grid, entities, spawn, stairsUp: up, stairsDown: down, boss: false };
}

function makeMonster(f, tier, rng) {
  const stats = monsterStats(f, tier);
  return {
    kind: 'monster', tier, name: tier === 'boss' ? BOSS_NAME : pick(rng, MONSTER_NAMES),
    maxHp: stats.hp, hp: stats.hp, atk: stats.atk, def: stats.def, exp: stats.exp, gold: stats.gold, miss: stats.miss,
  };
}

// open → rock → pit → gem 侧支路（推进墙区，不破坏主路径）
function placeRockPocket(grid, entities, freeCells, rng, id) {
  const rows = grid.length;
  const cols = grid[0].length;
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const app = freeCells[Math.floor(rng() * freeCells.length)];
    if (!app) return;
    const d = dirs[Math.floor(rng() * dirs.length)];
    const cells = [
      { r: app.r + d[0], c: app.c + d[1] },
      { r: app.r + 2 * d[0], c: app.c + 2 * d[1] },
      { r: app.r + 3 * d[0], c: app.c + 3 * d[1] },
    ];
    const inBounds = cells.every((p) => p.r >= 0 && p.r < rows && p.c >= 0 && p.c < cols);
    if (!inBounds) continue;
    const [rock, pit, gem] = cells;
    if (grid[rock.r][rock.c] !== 'wall') continue;
    if (grid[pit.r][pit.c] !== 'wall') continue;
    if (grid[gem.r][gem.c] !== 'wall') continue;
    grid[rock.r][rock.c] = 'floor';
    grid[pit.r][pit.c] = 'pit';
    grid[gem.r][gem.c] = 'floor';
    entities[keyOf(rock.r, rock.c)] = { kind: 'rock' };
    entities[keyOf(gem.r, gem.c)] = { kind: 'item', id: id % 2 === 0 ? 'gem_atk' : 'potion_large' };
    // 从 freeCells 移除 gem（rock/pit 本不是 freeCell）
    const idx = freeCells.findIndex((p) => p.r === gem.r && p.c === gem.c);
    if (idx >= 0) freeCells.splice(idx, 1);
    return;
  }
}

function placeDoors(grid, entities, freeCells, rng, id) {
  // 放一扇门 + 门后宝藏 + 同层钥匙（侧支路，不锁主路径）
  const colors = ['yellow', 'blue', 'red'];
  const color = colors[id % 3];
  const treasure = id % 2 === 0 ? 'gem_def' : 'potion_large';
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const doorCell = freeCells[Math.floor(rng() * freeCells.length)];
    if (!doorCell) return;
    const d = dirs[Math.floor(rng() * dirs.length)];
    const behind = { r: doorCell.r + d[0], c: doorCell.c + d[1] };
    if (behind.r < 0 || behind.r >= grid.length || behind.c < 0 || behind.c >= grid[0].length) continue;
    if (grid[behind.r][behind.c] !== 'floor') continue;
    const behindKey = keyOf(behind.r, behind.c);
    if (entities[behindKey]) continue;
    // 门后的宝藏格，其背后应是墙（死胡同），否则门无意义
    const beyond = { r: behind.r + d[0], c: behind.c + d[1] };
    const beyondIsWall = beyond.r < 0 || beyond.r >= grid.length || beyond.c < 0 || beyond.c >= grid[0].length || grid[beyond.r][beyond.c] === 'wall';
    if (!beyondIsWall) continue;
    // 移除 doorCell / behind 从 freeCells，放置
    entities[keyOf(doorCell.r, doorCell.c)] = { kind: 'door', color };
    entities[behindKey] = { kind: 'item', id: treasure };
    // 同层放一把对应钥匙
    const keyCell = freeCells[Math.floor(rng() * freeCells.length)];
    if (keyCell) entities[keyOf(keyCell.r, keyCell.c)] = { kind: 'item', id: `key_${color}` };
    removeFree(freeCells, doorCell);
    removeFree(freeCells, behind);
    return;
  }
}

function removeFree(freeCells, cell) {
  const idx = freeCells.findIndex((p) => p.r === cell.r && p.c === cell.c);
  if (idx >= 0) freeCells.splice(idx, 1);
}

function blocked(r, c, grid, entities) {
  if (grid[r][c] === 'wall' || grid[r][c] === 'pit') return true;
  const e = entities[keyOf(r, c)];
  if (!e) return false;
  return e.kind === 'monster' || e.kind === 'door' || e.kind === 'rock';
}

function ensureReachable(grid, entities, rows, cols, spawn, up) {
  const reachable = () => findPath(rows, cols, spawn, up, (r, c) => blocked(r, c, grid, entities)).length > 0;
  if (reachable()) return;
  // 移除挡路怪直到可达
  const monsterKeys = Object.keys(entities).filter((k) => entities[k].kind === 'monster');
  for (const k of monsterKeys) {
    delete entities[k];
    if (reachable()) return;
  }
}

// ---- 对外入口 ----
export function generateFloor(id, seed = 1) {
  const rng = mulberry32(seed * 7919 + id * 131 + 7);
  if (id === 0) return homeFloor();
  if (id === 50) return bossFloor(rng);
  return mazeFloor(id, rng);
}
