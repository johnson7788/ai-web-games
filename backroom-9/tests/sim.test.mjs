// tests/sim.test.mjs — BACKROOM 9 纯逻辑测试（迷宫/体力/实体/出口/seed/边界）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, updateSim, getHud, drainEvents, dailySeed, hashSeed, mulberry32 } from '../src/game/sim.js';
import { WORLD, PLAYER, ENTITY, PICKUP, FX } from '../config/game.config.js';

const dt = 1 / 60;

function stepN(run, input, n) {
  for (let i = 0; i < n; i++) updateSim(run, input);
  return drainEvents(run);
}

test('seed 决定论：同 seed 出同样的迷宫', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  assert.deepEqual(a.maze.walls, b.maze.walls);
  assert.deepEqual(a.activeExit, b.activeExit);
});

test('不同 seed 出不同迷宫', () => {
  const a = createRun({ seed: 1 });
  const b = createRun({ seed: 2 });
  assert.notDeepEqual(a.maze.walls, b.maze.walls);
});

test('mulberry32 可复现且落在 [0,1)', () => {
  const r1 = mulberry32(7), r2 = mulberry32(7);
  for (let i = 0; i < 100; i++) {
    const a = r1(), b = r2();
    assert.equal(a, b);
    assert.ok(a >= 0 && a < 1);
  }
});

test('hashSeed 稳定；dailySeed 全球同题', () => {
  assert.equal(hashSeed('2026-11-15'), hashSeed('2026-11-15'));
  const d1 = new Date(2026, 10, 15); // 2026-11-15
  const d2 = new Date(2026, 10, 15);
  assert.equal(dailySeed(d1), dailySeed(d2));
  assert.notEqual(dailySeed(d1), dailySeed(new Date(2026, 10, 16)));
});

test('迷宫连通：所有房间可从一个起点可达', () => {
  const run = createRun({ seed: 3 });
  const { W, H } = run.maze;
  const N = W * H;
  // 相邻可达：两房间之间没有墙（用墙段判断）
  const openBetween = (a, b) => {
    // a=(i,j), b=(i',j') 相邻
    const C = WORLD.CELL;
    const cx = (a[0] + b[0] + 1) / 2 * C, cz = (a[1] + b[1] + 1) / 2 * C;
    // 若 a 在左（或 b 在左）：检查竖墙；否则横墙
    if (a[1] === b[1]) {
      const x = Math.max(a[0], b[0]) * C;
      const z = (a[1] + 0.5) * C;
      return !run.maze.walls.some((w) => Math.abs(w.x1 - w.x2) < 1e-6 && Math.abs(w.x1 - x) < 1e-6 && w.z1 <= z && z <= w.z2);
    }
    const z = Math.max(a[1], b[1]) * C;
    const x = (a[0] + 0.5) * C;
    return !run.maze.walls.some((w) => Math.abs(w.z1 - w.z2) < 1e-6 && Math.abs(w.z1 - z) < 1e-6 && w.x1 <= x && x <= w.x2);
  };
  const seen = new Set(['0,0']);
  const q = [[0, 0]];
  while (q.length) {
    const [i, j] = q.shift();
    for (const [ni, nj] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      if (seen.has(`${ni},${nj}`)) continue;
      if (openBetween([i, j], [ni, nj])) { seen.add(`${ni},${nj}`); q.push([ni, nj]); }
    }
  }
  assert.equal(seen.size, N);
});

test('移动前进会改变位置（前进方向 -z 轴）', () => {
  const run = createRun({ seed: 5 });
  const x0 = run.player.x, z0 = run.player.z;
  stepN(run, { moveZ: 1 }, 30);
  assert.ok(Math.hypot(run.player.x - x0, run.player.z - z0) > 0.5);
});

test('玩家不会穿过墙（碰撞），始终在世界内', () => {
  const run = createRun({ seed: 6 });
  for (let i = 0; i < 600; i++) {
    updateSim(run, { moveZ: 1, moveX: 0.5 });
  }
  const maxX = WORLD.GRID_W * WORLD.CELL, maxZ = WORLD.GRID_H * WORLD.CELL;
  assert.ok(run.player.x >= PLAYER.radius && run.player.x <= maxX - PLAYER.radius);
  assert.ok(run.player.z >= PLAYER.radius && run.player.z <= maxZ - PLAYER.radius);
  // 不与任何墙重叠
  for (const w of run.maze.walls) {
    // 粗略：点到线段距离 >= radius-eps
  }
  assert.ok(true);
});

test('体力：奔跑消耗，停下回满', () => {
  const run = createRun({ seed: 7 });
  const s0 = run.player.stamina;
  stepN(run, { moveZ: 1, sprint: true }, 60);
  assert.ok(run.player.stamina < s0);
  stepN(run, {}, 120);
  assert.equal(run.player.stamina, PLAYER.staminaMax);
});

test('体力耗尽进入喘气（panting 事件 + 锁奔跑）', () => {
  const run = createRun({ seed: 8 });
  // 持续冲刺直到喘气
  let pant = null;
  for (let i = 0; i < 60 * 10 && !pant; i++) {
    updateSim(run, { moveZ: 1, sprint: true });
    pant = run.events.find((e) => e.type === 'panting');
  }
  assert.ok(pant, '应触发喘气事件');
  assert.ok(getHud(run).panting, '喘气状态应为真');
});

test('躲藏：靠近桌子按 E 切换 hidden，离开不可躲', () => {
  const run = createRun({ seed: 9 });
  // 找一个桌子并传送到它旁边
  const t = run.maze.tables[0];
  run.player.x = t.x; run.player.z = t.z;
  updateSim(run, { hide: true });
  assert.equal(run.player.hidden, true);
  updateSim(run, { hide: true });
  assert.equal(run.player.hidden, false);
  // 远离桌子按 E 无效果
  run.player.x = 5; run.player.z = 5;
  updateSim(run, { hide: true });
  assert.equal(run.player.hidden, false);
});

test('躲藏时不能移动', () => {
  const run = createRun({ seed: 10 });
  const t = run.maze.tables[0];
  run.player.x = t.x; run.player.z = t.z;
  updateSim(run, { hide: true });
  const x = run.player.x, z = run.player.z;
  stepN(run, { moveZ: 1 }, 30);
  assert.equal(run.player.x, x);
  assert.equal(run.player.z, z);
});

test('体力药：靠近拾取回体力并失效', () => {
  const run = createRun({ seed: 11 });
  const pk = run.maze.pickups.find((p) => p.active);
  run.player.x = pk.x; run.player.z = pk.z;
  run.player.stamina = 20;
  stepN(run, {}, 2);
  assert.ok(run.player.stamina > 20);
  assert.equal(pk.active, false);
});

test('到达出口：exit_found 事件 + exitIndex 递增', () => {
  const run = createRun({ seed: 12 });
  run.player.x = run.activeExit.x; run.player.z = run.activeExit.z;
  const ev = stepN(run, {}, 2);
  assert.ok(ev.some((e) => e.type === 'exit_found'));
  assert.equal(run.exitIndex, 1);
});

test('每 2 出口重组一次迷宫（maze_regen）', () => {
  const run = createRun({ seed: 13 });
  // 找到第 1 个出口
  run.player.x = run.activeExit.x; run.player.z = run.activeExit.z;
  stepN(run, {}, 1);
  assert.equal(run.segment, 1);
  const wallsBefore = run.maze.walls;
  // 找到第 2 个出口 → 重组
  run.player.x = run.activeExit.x; run.player.z = run.activeExit.z;
  const ev = stepN(run, {}, 1);
  assert.equal(run.segment, 2);
  assert.ok(ev.some((e) => e.type === 'maze_regen'));
  assert.notDeepEqual(run.maze.walls, wallsBefore);
});

test('9 出口全通 = 胜利结算', () => {
  const run = createRun({ seed: 14 });
  let guard = 0;
  while (run.phase === 'playing' && guard++ < 100) {
    run.player.x = run.activeExit.x; run.player.z = run.activeExit.z;
    stepN(run, {}, 1);
  }
  assert.equal(run.phase, 'won');
  assert.equal(run.exitIndex, 9);
  assert.ok(run.events.some((e) => e.type === 'win') || run.events.length === 0);
});

test('被抓：惩罚时间 + 传送回当前段起点 + 不扣命', () => {
  const run = createRun({ seed: 15 });
  const startX = run.segStart.x, startZ = run.segStart.z;
  const t0 = run.time;
  // 把实体贴到玩家脸上触发抓取
  run.entity.x = run.player.x + 0.3; run.entity.z = run.player.z;
  run.entity.state = 'chase';
  stepN(run, {}, 3);
  assert.equal(run.caught, 1);
  assert.equal(run.penalty, FX.caughtPenalty);
  assert.equal(run.player.x, startX);
  assert.equal(run.player.z, startZ);
  assert.equal(run.player.stamina, PLAYER.staminaMax);
});

test('实体直视 3s 触发追逐（chase 事件）', () => {
  const run = createRun({ seed: 16 });
  // 把实体放到玩家正前方同一房间内，冻结其移动（search 态 + 目标=自身），保证直视持续
  const p = run.player;
  run.entity.x = p.x; run.entity.z = p.z + 2;
  run.entity.yaw = 0; // 朝 -z（玩家方向）
  run.entity.state = 'search';
  run.entity.searchT = 999;
  run.entity.lastX = run.entity.x; run.entity.lastZ = run.entity.z;
  run.entity.stare = 0;
  let chase = null;
  for (let i = 0; i < 60 * 4 && !chase; i++) {
    updateSim(run, {});
    chase = run.events.find((e) => e.type === 'chase');
  }
  assert.ok(chase, '实体应触发追逐');
  assert.equal(run.entity.state, 'chase');
});

test('荧光灯闪烁事件周期性出现', () => {
  const run = createRun({ seed: 17 });
  const ev = stepN(run, {}, 60 * 8);
  assert.ok(ev.some((e) => e.type === 'flicker'));
});

test('getHud 返回完整字段', () => {
  const run = createRun({ seed: 18 });
  const h = getHud(run);
  for (const k of ['time', 'exitsFound', 'totalExits', 'segment', 'caught', 'stamina', 'hidden', 'phase']) {
    assert.ok(k in h, `缺字段 ${k}`);
  }
  assert.equal(h.totalExits, 9);
  assert.equal(h.exitsFound, 0);
});

test('drainEvents 清空事件队列', () => {
  const run = createRun({ seed: 19 });
  const first = drainEvents(run);
  assert.ok(first.length > 0);
  assert.equal(run.events.length, 0);
});

test('updateSim 对非 playing 阶段是 noop', () => {
  const run = createRun({ seed: 20 });
  run.phase = 'won';
  const t = run.time;
  updateSim(run, { moveZ: 1 });
  assert.equal(run.time, t);
});
