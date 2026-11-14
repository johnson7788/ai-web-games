import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, tick, getHud, makeRng } from '../src/game/sim.js';
import { TILE, COLS, ROWS, BLOCKS, PLAYER } from '../config/game.config.js';

const step = (run, n, input = {}) => { for (let i = 0; i < n; i++) tick(run, 1 / 60, input); };
const surfaceRow = (run, c) => { for (let r = 0; r < ROWS; r++) if (run.grid[r][c] !== 0) return r; return ROWS; };

test('创建：网格尺寸正确，玩家在地表，起始有泥土', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.grid.length, ROWS);
  assert.equal(run.grid[0].length, COLS);
  assert.equal(run.phase, 'play');
  assert.ok(run.inventory[2] >= 8);
  assert.ok(run.player.onGround);
});

test('地形：地表草方块，下方泥土/石头，上方空气', () => {
  const run = createRun({ seed: 2 });
  const c = 20, s = surfaceRow(run, c);
  assert.ok(s > 0 && s < ROWS);
  assert.equal(run.grid[s - 1][c], 0);
  assert.ok(run.grid[s][c] !== 0);
  assert.ok(run.grid[ROWS - 1][c] !== 0);
});

test('移动：右移使玩家位移', () => {
  const run = createRun({ seed: 1 });
  const x0 = run.player.x;
  step(run, 20, { right: true });
  assert.ok(run.player.x > x0);
});

test('跳跃与重力：跳起后落回地表', () => {
  const run = createRun({ seed: 1 });
  const y0 = run.player.y;
  step(run, 2, { jump: true });
  assert.ok(run.player.y < y0);
  step(run, 90, {});
  assert.ok(run.player.onGround);
});

test('碰撞：站立不会穿过地面', () => {
  const run = createRun({ seed: 1 });
  const y0 = run.player.y;
  step(run, 60, {});
  assert.equal(run.player.y, y0);
  assert.ok(run.player.onGround);
});

test('挖掘：范围内挖掉方块并入库', () => {
  const run = createRun({ seed: 1 });
  const c = 21, r = surfaceRow(run, c);
  const before = run.inventory[2];
  const mouse = { x: (c + 0.5) * TILE, y: (r + 0.5) * TILE };
  step(run, 60, { mining: true, mouse });
  assert.equal(run.grid[r][c], 0);
  assert.ok(run.mined >= 1);
  assert.ok(run.inventory[2] >= before);
});

test('放置：空气格放置方块并消耗库存', () => {
  const run = createRun({ seed: 1 });
  run.inventory[2] = 5;
  const c = 21, r = surfaceRow(run, c);
  const mouse = { x: (c + 0.5) * TILE, y: (r + 0.5) * TILE };
  step(run, 60, { mining: true, mouse });   // 先挖出一个空气格
  assert.equal(run.grid[r][c], 0);
  const before = run.inventory[2];
  step(run, 4, { placing: true, mouse });    // 再放回去
  assert.equal(run.grid[r][c], 2);
  assert.equal(run.inventory[2], before - 1);
  assert.ok(run.placed >= 1);
});

test('范围：超出挖掘距离无效', () => {
  const run = createRun({ seed: 1 });
  const c = 35, r = surfaceRow(run, c); // 远离玩家
  const mouse = { x: (c + 0.5) * TILE, y: (r + 0.5) * TILE };
  const id = run.grid[r][c];
  step(run, 60, { mining: true, mouse });
  assert.equal(run.grid[r][c], id);
});

test('选择：切换快捷栏', () => {
  const run = createRun({ seed: 1 });
  run.selected = 2;
  assert.equal(getHud(run).selected, 2);
  assert.equal(getHud(run).hotbar[2], 4);
});

test('RNG：同种子地形一致', () => {
  const a = createRun({ seed: 42 }), b = createRun({ seed: 42 });
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      assert.equal(a.grid[r][c], b.grid[r][c]);
});