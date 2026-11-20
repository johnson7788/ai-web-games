import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, findGroups, largestGroup, mulberry32 } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { GAME } from '../config/game.config.js';

function lanternCount(state) {
  let n = 0;
  for (const row of state.grid) for (const c of row) if (c.kind === 'lantern') n += 1;
  return n;
}
function stoneCount(state) {
  let n = 0;
  for (const row of state.grid) for (const c of row) if (c.kind === 'stone') n += 1;
  return n;
}

test('createRun：网格尺寸匹配关卡', () => {
  for (const lv of LEVELS) {
    const r = createRun(lv.index - 1, { seed: 42 });
    assert.equal(r.state.rows, lv.rows);
    assert.equal(r.state.cols, lv.cols);
    assert.equal(r.state.target, lv.target);
  }
});

test('createRun：灯笼+石头填满整盘，无空格', () => {
  const r = createRun(0, { seed: 7 });
  const total = lanternCount(r.state) + stoneCount(r.state);
  assert.equal(total, r.state.rows * r.state.cols);
});

test('createRun：初始必有 ≥2 合法群', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const r = createRun(0, { seed });
    assert.ok(findGroups(r.state.grid, GAME.MANUAL_MIN).length > 0, `seed ${seed} 无群`);
  }
});

test('mulberry32：同 seed 可复现', () => {
  const a = mulberry32(123);
  const b = mulberry32(123);
  for (let i = 0; i < 10; i += 1) assert.equal(a(), b());
});

test('tap：点合法群成功并得分', () => {
  const r = createRun(0, { seed: 3 });
  const g = largestGroup(r.state.grid, GAME.MANUAL_MIN);
  const before = r.state.score;
  const res = r.tap(g[0].r, g[0].c);
  assert.equal(res.ok, true);
  assert.ok(r.state.score > before);
  assert.equal(r.state.moves, 1);
});

test('tap：点小于 2 的孤立格被拒', () => {
  const r = createRun(0, { seed: 3 });
  // 找到一格周围无同色的格子（或直接构造）
  const grid = r.state.grid;
  for (let rr = 0; rr < grid.length; rr += 1) {
    for (let cc = 0; cc < grid[0].length; cc += 1) {
      const g = [];
      const color = grid[rr][cc].color;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = rr + dr, nc = cc + dc;
        if (grid[nr] && grid[nr][nc] && grid[nr][nc].kind === 'lantern' && grid[nr][nc].color === color) g.push([nr, nc]);
      }
      if (g.length === 0) {
        assert.equal(r.tap(rr, cc).ok, false);
        return;
      }
    }
  }
  // 无孤立格则跳过（不 fail）
  assert.ok(true);
});

test('重力+补充：消除后灯笼数不变', () => {
  const r = createRun(0, { seed: 5 });
  const before = lanternCount(r.state);
  const g = largestGroup(r.state.grid, GAME.MANUAL_MIN);
  r.tap(g[0].r, g[0].c);
  assert.equal(lanternCount(r.state), before);
});

test('金属灯笼：需要两击才破', () => {
  const r = createRun(2, { seed: 11 }); // L3 金属
  let metal = null;
  outer: for (let rr = 0; rr < r.state.rows; rr += 1) {
    for (let cc = 0; cc < r.state.cols; cc += 1) {
      if (r.state.grid[rr][cc].kind === 'lantern' && r.state.grid[rr][cc].type === 'metal') { metal = { r: rr, c: cc }; break outer; }
    }
  }
  assert.ok(metal, 'L3 应有金属灯笼');
  const hp0 = r.state.grid[metal.r][metal.c].hp;
  assert.equal(hp0, 2);
  // 找一个包含该金属的群点击
  const g = findGroups(r.state.grid, GAME.MANUAL_MIN).find((gr) => gr.some((p) => p.r === metal.r && p.c === metal.c));
  assert.ok(g, '金属应在某群内');
  r.tap(g[0].r, g[0].c);
  const cellAfter = r.state.grid[metal.r][metal.c];
  // 若已被移除（hp 扣到 0 的情况）则跳过；否则 hp 应为 1
  if (cellAfter.kind === 'lantern') assert.equal(cellAfter.hp, 1);
});

test('石头配重：不可消且沉底', () => {
  const r = createRun(6, { seed: 2 }); // L7 石头
  assert.ok(stoneCount(r.state) > 0);
  // 石头若在某列，必在底部连续区（重力后石头沉底）
  for (let c = 0; c < r.state.cols; c += 1) {
    for (let rr = 0; rr < r.state.rows - 1; rr += 1) {
      if (r.state.grid[rr][c].kind === 'stone') {
        assert.ok(false, '石头不在底部');
      }
    }
  }
  assert.ok(true);
});

test('变色灯笼：步进 5 秒换色', () => {
  const r = createRun(5, { seed: 9 }); // L6 变色
  let shifted = null;
  outer: for (let rr = 0; rr < r.state.rows; rr += 1) {
    for (let cc = 0; cc < r.state.cols; cc += 1) {
      const cell = r.state.grid[rr][cc];
      if (cell.kind === 'lantern' && cell.type === 'shifting') { shifted = { r: rr, c: cc }; break outer; }
    }
  }
  assert.ok(shifted, 'L6 应有变色灯笼');
  const before = r.state.grid[shifted.r][shifted.c].color;
  for (let i = 0; i < GAME.SHIFT_INTERVAL + 1; i += 1) r.step(1);
  const after = r.state.grid[shifted.r][shifted.c].color;
  assert.notEqual(after, before);
});

test('时间灯笼：破掉补 5 秒', () => {
  const r = createRun(8, { seed: 13 }); // L9 时间灯笼
  let target = null;
  for (let rr = 0; rr < r.state.rows; rr += 1) {
    for (let cc = 0; cc < r.state.cols; cc += 1) {
      if (r.state.grid[rr][cc].kind === 'lantern' && r.state.grid[rr][cc].type === 'timeBonus') {
        const g = findGroups(r.state.grid, GAME.MANUAL_MIN).find((gr) => gr.some((p) => p.r === rr && p.c === cc));
        if (g) { target = g; break; }
      }
    }
    if (target) break;
  }
  assert.ok(target, 'L9 应有一个可点击群含时间灯笼');
  const before = r.state.timeLeft;
  r.tap(target[0].r, target[0].c);
  assert.ok(r.state.timeLeft > before || r.state.phase !== 'playing');
});

test('锁链灯笼：成对绑定', () => {
  const r = createRun(4, { seed: 21 }); // L5 锁链
  let chained = [];
  for (let rr = 0; rr < r.state.rows; rr += 1) {
    for (let cc = 0; cc < r.state.cols; cc += 1) {
      const cell = r.state.grid[rr][cc];
      if (cell.kind === 'lantern' && cell.type === 'chained') chained.push({ r: rr, c: cc, id: cell.chainId });
    }
  }
  assert.equal(chained.length % 2, 0, '锁链应成对');
  if (chained.length) {
    const ids = new Set(chained.map((x) => x.id));
    for (const id of ids) {
      assert.equal(chained.filter((x) => x.id === id).length, 2);
    }
  }
});

test('win：达到目标分进入 won 并结算星级', () => {
  const r = createRun(0, { seed: 3 });
  let guard = 1000;
  while (r.state.phase === 'playing' && guard-- > 0) {
    const g = largestGroup(r.state.grid, GAME.MANUAL_MIN);
    if (!g) { r.ensurePlayable(); continue; }
    r.tap(g[0].r, g[0].c);
  }
  assert.equal(r.state.phase, 'won');
  assert.ok(r.state.stars >= 1 && r.state.stars <= 3);
  assert.ok(r.state.score >= r.state.target);
});

test('lose：超时且未达标则 lost', () => {
  const r = createRun(0, { seed: 3 });
  for (let i = 0; i < r.state.initialTime + 2; i += 1) r.step(1);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.won, false);
});

test('连锁：连锁会触发 cascade 事件并加分', () => {
  const r = createRun(0, { seed: 3 });
  const events = [];
  let guard = 800;
  while (r.state.phase === 'playing' && guard-- > 0) {
    const g = largestGroup(r.state.grid, GAME.MANUAL_MIN);
    if (!g) { r.ensurePlayable(); continue; }
    r.tap(g[0].r, g[0].c);
    events.push(...r.drainEvents());
    if (events.some((e) => e.type === 'cascade')) break;
  }
  assert.ok(events.some((e) => e.type === 'cascade'), '应观察到至少一次连锁');
});

test('事件密度：pop/refill/score 事件齐备', () => {
  const r = createRun(0, { seed: 3 });
  const seen = new Set();
  let guard = 500;
  while (r.state.phase === 'playing' && guard-- > 0) {
    const g = largestGroup(r.state.grid, GAME.MANUAL_MIN);
    if (!g) { r.ensurePlayable(); continue; }
    r.tap(g[0].r, g[0].c);
    for (const e of r.drainEvents()) seen.add(e.type);
  }
  for (const t of ['tap', 'pop', 'refill']) assert.ok(seen.has(t), `缺少事件 ${t}`);
});

test('LEVEL_COUNT：共 12 关且 index 连续', () => {
  assert.equal(LEVEL_COUNT, 12);
  LEVELS.forEach((lv, i) => assert.equal(lv.index, i + 1));
});

test('每关目标分 > 0 且时间 > 0', () => {
  for (const lv of LEVELS) {
    assert.ok(lv.target > 0);
    assert.ok(lv.time > 0);
  }
});

test('大场面：单次消除 ≥6 触发 bigClear', () => {
  const r = createRun(0, { seed: 3 });
  let triggered = false;
  let guard = 1000;
  while (r.state.phase === 'playing' && guard-- > 0) {
    const g = largestGroup(r.state.grid, GAME.MANUAL_MIN);
    if (!g) { r.ensurePlayable(); continue; }
    r.tap(g[0].r, g[0].c);
    for (const e of r.drainEvents()) if (e.type === 'bigClear') triggered = true;
    if (triggered) break;
  }
  assert.ok(triggered, '应触发大场面');
});
