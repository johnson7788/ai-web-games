import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genBlock, greedyNextTarget, greedyDir, bfsPath, doorUnlocked } from '../src/game/mapgen.js';
import { mulberry32 } from '../src/game/rng.js';
import { T, idx } from '../config/gameplay.js';
import { BLOCKS } from '../config/levels.js';

// 用贪婪策略走到出口，返回步数（不可解返回 Infinity）
function solveSteps(map) {
  const state = {
    player: map.start,
    keyCollected: 0,
    leverOn: false,
    cluesCollected: 0,
    clueTaken: new Array(map.clues.length).fill(false),
  };
  let steps = 0;
  for (let g = 0; g < 600; g += 1) {
    const dir = greedyDir(map, state);
    if (!dir) return Infinity;
    const d = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } }[dir];
    const nx = state.player.x + d.dx;
    const ny = state.player.y + d.dy;
    state.player = { x: nx, y: ny };
    steps += 1;
    if (map.key && nx === map.key.x && ny === map.key.y) state.keyCollected = 1;
    if (map.lever && nx === map.lever.x && ny === map.lever.y) state.leverOn = true;
    for (let i = 0; i < map.clues.length; i += 1) {
      const c = map.clues[i];
      if (nx === c.x && ny === c.y && !state.clueTaken[i]) { state.clueTaken[i] = true; state.cluesCollected += 1; }
    }
    if (nx === map.exit.x && ny === map.exit.y) return steps;
  }
  return Infinity;
}

test('12 个街区全部可解（贪婪必达出口）', () => {
  for (let b = 0; b < BLOCKS.length; b += 1) {
    const map = genBlock(BLOCKS[b], mulberry32(1000 + b));
    assert.ok(Number.isFinite(map.par) && map.par > 0, `block ${b + 1} par=${map.par}`);
    assert.ok(map.maxSteps > map.par, `block ${b + 1} maxSteps 应大于 par`);
    const steps = solveSteps(map);
    assert.ok(Number.isFinite(steps), `block ${b + 1} 贪婪不可解`);
    assert.ok(steps <= map.maxSteps, `block ${b + 1} 贪婪 ${steps} 步超过 maxSteps ${map.maxSteps}`);
  }
});

test('bfsPath：start→exit 存在且不穿墙', () => {
  const map = genBlock(BLOCKS[0], mulberry32(7));
  const blocked = (i) => map.cells[i] === T.WALL || map.danger[i] === 1;
  const path = bfsPath(map, map.start, map.exit, blocked);
  assert.ok(path, '应存在路径');
  for (const p of path) {
    assert.notEqual(map.cells[idx(p.x, p.y)], T.WALL, '路径不应穿墙');
  }
});

test('门锁逻辑：key/lever/clues 条件', () => {
  const map = { doorNeeds: 'keyAndLever', clueCount: 3, key: { x: 1, y: 1 }, lever: { x: 2, y: 2 }, clues: [] };
  assert.equal(doorUnlocked(map, { keyCollected: 0, leverOn: true, cluesCollected: 3 }), false);
  assert.equal(doorUnlocked(map, { keyCollected: 1, leverOn: true, cluesCollected: 3 }), true);
  assert.equal(doorUnlocked({ doorNeeds: 'none', clueCount: 0 }, {}), true);
});

test('greedyNextTarget 优先级：钥匙→杠杆→线索→出口', () => {
  const map = {
    doorNeeds: 'keyAndLever', clueCount: 3,
    key: { x: 5, y: 5 }, lever: { x: 2, y: 2 }, clues: [{ x: 3, y: 3 }, { x: 4, y: 4 }, { x: 6, y: 6 }],
    exit: { x: 9, y: 9 },
  };
  const state = { player: { x: 0, y: 0 }, keyCollected: 0, leverOn: false, cluesCollected: 0, clueTaken: [false, false, false] };
  assert.deepEqual(greedyNextTarget(map, state), map.key);
  state.keyCollected = 1;
  assert.deepEqual(greedyNextTarget(map, state), map.lever);
  state.leverOn = true;
  assert.deepEqual(greedyNextTarget(map, state), map.clues[0]);
  state.cluesCollected = 3;
  state.clueTaken = [true, true, true];
  assert.deepEqual(greedyNextTarget(map, state), map.exit);
});

test('守卫不落在贪婪路径上（危险区避开 spine）', () => {
  const map = genBlock(BLOCKS[11], mulberry32(88)); // 终局 3 守卫
  assert.ok(map.guards.length > 0);
  const state = { player: map.start, keyCollected: 0, leverOn: false, cluesCollected: 0, clueTaken: new Array(map.clues.length).fill(false) };
  // 走贪婪路径，途中不得踏入 danger
  for (let g = 0; g < 300; g += 1) {
    const dir = greedyDir(map, state);
    if (!dir) break;
    const d = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } }[dir];
    state.player = { x: state.player.x + d.dx, y: state.player.y + d.dy };
    assert.notEqual(map.danger[idx(state.player.x, state.player.y)], 1, '贪婪不应踏入守卫视线');
    if (map.key && state.player.x === map.key.x && state.player.y === map.key.y) state.keyCollected = 1;
    if (map.lever && state.player.x === map.lever.x && state.player.y === map.lever.y) state.leverOn = true;
    for (let i = 0; i < map.clues.length; i += 1) {
      const c = map.clues[i];
      if (state.player.x === c.x && state.player.y === c.y && !state.clueTaken[i]) { state.clueTaken[i] = true; state.cluesCollected += 1; }
    }
    if (state.player.x === map.exit.x && state.player.y === map.exit.y) break;
  }
});
