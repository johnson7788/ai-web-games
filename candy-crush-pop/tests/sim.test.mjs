import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, findRuns, findHint, hasValidMove, runScore, mulberry32 } from '../src/game/sim.js';

function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

// 推进到本局终局（或 maxSec 上限）
function settle(run, maxSec = 30) {
  let guard = 0;
  const max = Math.round(maxSec * 60);
  while (run.state.phase === 'playing' && guard++ < max) run.step(1 / 60);
}

test('冒烟：createRun → step → hint → swap → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  r.step(1 / 60);
  const h = r.hint();
  assert.ok(h);
  assert.equal(r.swap(h.a, h.b).ok, true);
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.phase, 'playing');
  assert.ok(Array.isArray(r.drainEvents()));
});

test('state 形状：level/phase/rows/cols/grid 尺寸/moves/target', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'playing');
  assert.equal(s.rows, 10);
  assert.equal(s.cols, 8);
  assert.equal(s.grid.length, 10);
  assert.equal(s.grid[0].length, 8);
  assert.ok(s.moves > 0);
  assert.ok(s.target > 0);
  assert.equal(s.movesLeft, s.moves);
});

test('runScore：3/4/5/6 连计分正确且递增', () => {
  assert.equal(runScore(3), 50);
  assert.equal(runScore(4), 90);
  assert.equal(runScore(5), 150);
  assert.equal(runScore(6), 220);
  assert.ok(runScore(7) > runScore(6));
  assert.equal(runScore(2), 0);
});

test('开局无预置三连，且至少存在一步可消', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(findRuns(s.grid, s.rows, s.cols).length, 0);
  assert.equal(hasValidMove(s.grid, s.rows, s.cols), true);
  assert.ok(findHint(s.grid, s.rows, s.cols));
});

test('swap：无效交换被拒绝（notAdjacent/bounds/busy/rock）', () => {
  const r = createRun(0, { seed: 1 });
  assert.deepEqual(r.swap({ r: 0, c: 0 }, { r: 2, c: 0 }), { ok: false, reason: 'notAdjacent' });
  assert.deepEqual(r.swap({ r: 0, c: 0 }, { r: 0, c: -1 }), { ok: false, reason: 'bounds' });
  const h = r.hint();
  r.swap(h.a, h.b);
  assert.deepEqual(r.swap({ r: 0, c: 0 }, { r: 0, c: 1 }), { ok: false, reason: 'busy' });
});

test('rock 格：不可交换、切断连线', () => {
  const r = createRun(3, { seed: 1 }); // L4 有岩石
  const s = r.state;
  const rocks = [];
  for (let rr = 0; rr < s.rows; rr += 1) {
    for (let cc = 0; cc < s.cols; cc += 1) if (s.grid[rr][cc].rock > 0) rocks.push({ r: rr, c: cc });
  }
  assert.ok(rocks.length > 0);
  // 尝试交换一个岩石格（找其右邻）
  const rock = rocks[0];
  const nb = { r: rock.r, c: rock.c + 1 };
  if (nb.c < s.cols && s.grid[nb.r][nb.c].rock === 0) {
    assert.deepEqual(r.swap(rock, nb), { ok: false, reason: 'rock' });
  }
});

test('有效交换：消耗一步并得分，级联回到 idle', () => {
  const r = createRun(0, { seed: 7 });
  const beforeMoves = r.state.movesLeft;
  const beforeScore = r.state.score;
  const h = r.hint();
  assert.ok(h);
  assert.equal(r.swap(h.a, h.b).ok, true);
  let guard = 0;
  while (r.state.action !== 'idle' && r.state.phase === 'playing' && guard++ < 6000) r.step(1 / 60);
  assert.equal(r.state.action, 'idle');
  assert.ok(r.state.movesLeft < beforeMoves);
  assert.ok(r.state.score > beforeScore);
});

test('失败弹回：换不出消除时不消耗步数', () => {
  const r = createRun(0, { seed: 5 });
  const s = r.state;
  // 找一个交换后不产生三连的相邻对
  let found = null;
  outer:
  for (let rr = 0; rr < s.rows; rr += 1) {
    for (let cc = 0; cc < s.cols; cc += 1) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const nr = rr + dr;
        const nc = cc + dc;
        if (nr >= s.rows || nc >= s.cols) continue;
        if (s.grid[rr][cc].rock > 0 || s.grid[nr][nc].rock > 0) continue;
        const g = s.grid;
        const t = g[rr][cc].type; g[rr][cc].type = g[nr][nc].type; g[nr][nc].type = t;
        const has = findRuns(g, s.rows, s.cols).length > 0;
        const t2 = g[rr][cc].type; g[rr][cc].type = g[nr][nc].type; g[nr][nc].type = t2;
        if (!has) { found = { a: { r: rr, c: cc }, b: { r: nr, c: nc } }; break outer; }
      }
    }
  }
  assert.ok(found, '应存在换不出消除的相邻对');
  const before = r.state.movesLeft;
  assert.equal(r.swap(found.a, found.b).ok, true);
  let guard = 0;
  while (r.state.action !== 'idle' && r.state.phase === 'playing' && guard++ < 6000) r.step(1 / 60);
  assert.equal(r.state.action, 'idle');
  assert.equal(r.state.movesLeft, before);
});

test('倒计时：timeLeft 递减', () => {
  const r = createRun(0, { seed: 1 });
  const before = r.state.timeLeft;
  r.step(0.5);
  assert.ok(r.state.timeLeft < before);
});

test('noinput：时间耗尽 → lose timeOut', () => {
  const r = createRun(0, { seed: 9 });
  settle(r, r.state.time + 2);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'timeOut');
});

test('步数耗尽未达标 → lose outOfMoves', () => {
  const r = createRun(0, { seed: 1 });
  r.state.target = 100;
  r.state.score = 50;
  r.state.movesLeft = 0;
  r._checkEnd();
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'outOfMoves');
});

test('胜利：达标 → win + 星级 + result', () => {
  const r = createRun(0, { seed: 1 });
  r.state.target = 1;
  const h = r.hint();
  assert.ok(h);
  r.swap(h.a, h.b);
  settle(r, 30);
  assert.equal(r.state.phase, 'won');
  assert.ok(r.state.stars >= 1);
  assert.equal(r.state.result.won, true);
});

test('mulberry32：同 seed 可复现，不同 seed 不同序列', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const c = mulberry32(43);
  const sa = [a(), a(), a()];
  const sb = [b(), b(), b()];
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, [c(), c(), c()]);
});
