import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { solve, availableMoves, normalizeLevel } from '../src/game/solver.js';
import { LEVELS } from '../config/levels.js';

test('冒烟：createRun → step → tryMove → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  r.step(1 / 60);
  const m = r.tryMove(1);
  assert.equal(m.ok, true);
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.phase, 'playing');
  const ev = r.drainEvents();
  assert.ok(Array.isArray(ev));
});

test('state 形状：level/phase/mode/nodes/edges/start/path', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'playing');
  assert.equal(s.mode, 'nodes');
  assert.equal(s.nodes.length, 3);
  assert.equal(s.edges.length, 2);
  assert.equal(s.start, 0);
  assert.deepEqual(s.path, [0]);
  assert.equal(s.current, 0);
});

test('L1 三节点链：0→1→2 通关，moves == par 得 3 星', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.tryMove(1).ok, true);
  assert.equal(r.tryMove(2).ok, true);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.moves, 2);
  assert.equal(r.state.par, 2);
  assert.equal(r.state.stars, 3);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'win' && e.stars === 3));
});

test('tryMove：越界 / 非邻接 / 终局后 校验', () => {
  const r = createRun(0, { seed: 1 });
  assert.deepEqual(r.tryMove(-1), { ok: false, reason: 'bounds' });
  assert.deepEqual(r.tryMove(99), { ok: false, reason: 'bounds' });
  assert.equal(r.tryMove(2).ok, false, '0 与 2 不相邻');
  r.tryMove(1);
  r.tryMove(2);
  assert.deepEqual(r.tryMove(0), { ok: false, reason: 'phase' });
});

test('回退：截断路径、恢复掩码、undos++，可重新走', () => {
  const r = createRun(0, { seed: 1 });
  r.tryMove(1);
  assert.equal(r.backtrack(0).ok, true);
  assert.deepEqual(r.state.path, [0]);
  assert.equal(r.state.current, 0);
  assert.equal(r.state.undos, 1);
  assert.equal(r.state.visitedMask & (1 << 1), 0, '回退后节点 1 不再已访问');
  assert.equal(r.tryMove(1).ok, true, '回退后可重新走');
  assert.equal(r.tryMove(2).ok, true);
  assert.equal(r.state.phase, 'won');
});

test('回退到当前星子/不在路径中的星子：失败', () => {
  const r = createRun(0, { seed: 1 });
  assert.deepEqual(r.backtrack(0), { ok: false, reason: 'notInPath' });
  r.tryMove(1);
  assert.deepEqual(r.backtrack(1), { ok: false, reason: 'notInPath' });
});

test('undo：回退一步', () => {
  const r = createRun(0, { seed: 1 });
  r.tryMove(1);
  assert.equal(r.undo().ok, true);
  assert.equal(r.state.current, 0);
});

test('死路判定：L7 直走 0→1→2→3 后无路可走 → lose deadEnd', () => {
  const r = createRun(6, { seed: 1 }); // L7 单向丝
  assert.equal(r.tryMove(1).ok, true);
  assert.equal(r.tryMove(2).ok, true);
  assert.equal(r.tryMove(3).ok, true);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'deadEnd');
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'lose' && e.reason === 'deadEnd'));
});

test('单向丝：逆箭头走失败', () => {
  const r = createRun(6, { seed: 1 }); // L7：0→1→2→3，1—4，4→2
  r.tryMove(1);
  r.tryMove(4);
  r.tryMove(2);
  // 2→1 反向（edge 1→2 单向），应失败
  assert.equal(r.tryMove(1).ok, false);
});

test('断线解锁：跳过触发星子则门锁死', () => {
  const r = createRun(7, { seed: 1 }); // L8：0—2 存在，但 2—3 需先访问 1
  assert.equal(r.tryMove(2).ok, true);
  assert.equal(r.tryMove(3).ok, false, '未访问触发星子 1，门应锁死');
});

test('断线解锁：先访问触发星子 1 即可过门通关', () => {
  const r = createRun(7, { seed: 1 });
  r.tryMove(1);
  r.tryMove(2);
  r.tryMove(3);
  r.tryMove(4);
  r.tryMove(5);
  assert.equal(r.state.phase, 'won');
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'gateUnlock' && e.a === 2 && e.b === 3));
});

test('edges 模式：L6 双三角可重走中心星，每条丝走一次', () => {
  const r = createRun(5, { seed: 1 }); // L6 边一次
  assert.equal(r.state.mode, 'edges');
  const seq = [1, 2, 0, 3, 4, 0];
  for (const id of seq) assert.equal(r.tryMove(id).ok, true, `走 ${id}`);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.moves, 6);
  assert.equal(r.state.par, 6);
});

test('edges 模式：同一根丝不能走第二次', () => {
  const r = createRun(5, { seed: 1 });
  r.tryMove(1);
  r.tryMove(0); // 回到 0，已走过 0-1
  assert.equal(r.tryMove(1).ok, false, '0-1 已走一次');
});

test('弃局：forfeit → lose giveUp', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.forfeit().ok, true);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'giveUp');
});

test('星级：多花步数（回退重织）降为 2 星', () => {
  const r = createRun(0, { seed: 1 });
  r.tryMove(1);
  r.backtrack(0);
  r.tryMove(1);
  r.tryMove(2); // moves=3 > par=2，但 ≤ par+1=3 → 2 星
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.stars, 2);
});

test('getHud：remaining/total/moves/par 一致', () => {
  const r = createRun(0, { seed: 1 });
  let h = r.getHud();
  assert.equal(h.total, 3);
  assert.equal(h.visited, 1); // 起点已访问
  assert.equal(h.remaining, 2);
  r.tryMove(1);
  h = r.getHud();
  assert.equal(h.visited, 2);
  assert.equal(h.remaining, 1);
});

test('solver 与 sim 的 availableMoves 一致', () => {
  const r = createRun(1, { seed: 1 }); // L2 轮盘
  const L = normalizeLevel(LEVELS[1]);
  const simOpts = r.available().map((o) => o.next).sort();
  const solOpts = availableMoves(L, r.state.current, {
    visitedMask: r.state.visitedMask,
    traversedMask: r.state.traversedMask,
    enteredMask: r.state.enteredMask,
  }).map((o) => o.next).sort();
  assert.deepEqual(simOpts, solOpts);
});

test('mulberry32：固定 seed 可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test('越界关卡回退到 L0，12 关全部可解', () => {
  const r = createRun(999, { seed: 1 });
  assert.equal(r.state.level, 1);
  for (const lv of LEVELS) {
    assert.ok(solve(lv), `L${lv.index} 应有解`);
  }
});
