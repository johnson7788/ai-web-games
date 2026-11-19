import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, isSolvable, shuffleCells, mulberry32 } from '../src/game/sim.js';
import { solveBoard, bestMoveIndex, heuristic, applySlide } from '../src/game/solver.js';
import { LEVELS } from '../config/levels.js';

test('冒烟：createRun → step → move → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  r.step(1 / 60);
  const b = r.state.blank;
  const n = r.state.size;
  const row = Math.floor(b / n);
  let t = -1;
  for (let c = 0; c < n; c += 1) {
    const i = row * n + c;
    if (i !== b) { t = i; break; }
  }
  const m = r.move(t);
  assert.equal(m.ok, true);
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.size, 3);
  const ev = r.drainEvents();
  assert.ok(Array.isArray(ev));
  assert.ok(ev.some((e) => e.type === 'start'));
});

test('state 形状：level/size/cells 长度/phase/空位', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.size, 3);
  assert.equal(s.cells.length, 9);
  assert.equal(s.phase, 'playing');
  assert.ok(s.cells.includes(0), '存在空位 0');
  assert.equal(s.cells.indexOf(0), s.blank);
});

test('打乱可解：多 seed 多关卡盘面都满足可解性', () => {
  for (const seed of [1, 2, 3, 7, 42]) {
    for (const lv of [0, 1, 2, 3, 4]) {
      const r = createRun(lv, { seed });
      assert.equal(isSolvable(r.state.cells, LEVELS[lv].size), true, `L${lv + 1} seed=${seed}`);
    }
  }
});

test('shuffleCells 总是可解', () => {
  const rng = mulberry32(9);
  for (const n of [3, 4, 5]) {
    const cells = shuffleCells(n, rng);
    assert.equal(isSolvable(cells, n), true);
    assert.equal(cells.length, n * n);
  }
});

test('已解盘面可解（isSolvable 基线）', () => {
  for (const n of [3, 4, 5]) {
    const L = n * n;
    const solved = [];
    for (let v = 1; v < L; v += 1) solved.push(v);
    solved.push(0);
    assert.equal(isSolvable(solved, n), true);
  }
});

test('move：同行滑动，空位移动到位，数字集合不变', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  const b = s.blank;
  const row = Math.floor(b / 3);
  const t = row * 3 + ((b % 3 + 1) % 3);
  const before = s.cells.filter((v) => v !== 0).sort((x, y) => x - y);
  const res = r.move(t);
  assert.equal(res.ok, true);
  assert.equal(s.blank, t);
  assert.equal(s.cells[t], 0);
  assert.equal(s.moves, 1);
  const after = s.cells.filter((v) => v !== 0).sort((x, y) => x - y);
  assert.deepEqual(after, before);
});

test('move：非同行同列拒绝 notAligned', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  s.cells = [1, 2, 3, 4, 0, 5, 6, 7, 8];
  s.blank = 4;
  assert.deepEqual(r.move(0), { ok: false, reason: 'notAligned' });
});

test('move：点空位自身拒绝 blank / 越界拒绝 bounds', () => {
  const r = createRun(0, { seed: 1 });
  assert.deepEqual(r.move(r.state.blank), { ok: false, reason: 'blank' });
  assert.deepEqual(r.move(99), { ok: false, reason: 'bounds' });
  assert.deepEqual(r.move(-1), { ok: false, reason: 'bounds' });
});

test('连击：连续两次归位 → combo 递增并发 combo 事件', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  s.cells = [1, 2, 3, 4, 5, 6, 0, 7, 8];
  s.blank = 6;
  const r1 = r.move(7); // 7 归位
  assert.equal(r1.ok, true);
  assert.equal(r1.landedHome, true);
  assert.equal(s.combo, 1);
  const r2 = r.move(8); // 8 归位，同时解出
  assert.equal(r2.landedHome, true);
  assert.equal(s.combo, 2);
  assert.equal(s.phase, 'won');
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'combo' && e.combo === 2));
});

test('非归位滑动重置连击', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  s.cells = [1, 2, 3, 4, 5, 6, 0, 7, 8];
  s.blank = 6;
  r.move(7); // combo=1
  assert.equal(s.combo, 1);
  // 空位在 7，点 6（同行，6 左移？6 在 6 归位，点它让它离开家）
  const res = r.move(6);
  assert.equal(res.ok, true);
  assert.equal(res.landedHome, false);
  assert.equal(s.combo, 0);
});

test('提示：消耗次数并给出第一个未归位 index', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  const before = s.hintLeft;
  const res = r.hint();
  assert.equal(res.ok, true);
  assert.equal(s.hintLeft, before - 1);
  assert.ok(res.index >= 0);
  assert.ok(r.drainEvents().some((e) => e.type === 'hint'));
});

test('提示：耗尽后拒绝 noHint', () => {
  const r = createRun(0, { seed: 1 });
  r.state.hintLeft = 0;
  assert.deepEqual(r.hint(), { ok: false, reason: 'noHint' });
});

test('重洗：消耗次数、清空步数与连击、仍可解', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  s.moves = 5;
  s.combo = 3;
  const res = r.shuffle();
  assert.equal(res.ok, true);
  assert.equal(s.moves, 0);
  assert.equal(s.combo, 0);
  assert.equal(isSolvable(s.cells, s.size), true);
  assert.ok(r.drainEvents().some((e) => e.type === 'shuffle'));
});

test('重洗：耗尽后拒绝 noShuffle', () => {
  const r = createRun(0, { seed: 1 });
  r.state.shuffleLeft = 0;
  assert.deepEqual(r.shuffle(), { ok: false, reason: 'noShuffle' });
});

test('超时：推进超过 timeLimit → lose timeOut', () => {
  const r = createRun(0, { seed: 1 });
  const n = Math.round((LEVELS[0].timeLimit + 1) * 60);
  for (let i = 0; i < n; i += 1) r.step(1 / 60);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.won, false);
  assert.ok(r.drainEvents().some((e) => e.type === 'lose' && e.reason === 'timeOut'));
});

test('胜利：一步归位 → win 且星级按时间/步数计算', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  s.cells = [1, 2, 3, 4, 5, 6, 7, 0, 8];
  s.blank = 7;
  s.time = 10;
  s.moves = 4;
  const res = r.move(8);
  assert.equal(res.ok, true);
  assert.equal(s.phase, 'won');
  assert.equal(s.stars, 3); // 1 + time(10≤45) + moves(5≤25)
  assert.equal(s.result.won, true);
  assert.ok(r.drainEvents().some((e) => e.type === 'win' && e.stars === 3));
});

test('星级：超时/超步只给 1 星（基础）', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  s.cells = [1, 2, 3, 4, 5, 6, 7, 0, 8];
  s.blank = 7;
  s.time = 999;
  s.moves = 999;
  r.move(8);
  assert.equal(s.phase, 'won');
  assert.equal(s.stars, 1);
});

test('里程碑：整行归位发 milestone 事件', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  s.cells = [1, 2, 3, 4, 5, 6, 7, 0, 8];
  s.blank = 7;
  r._resetMilestoneBaseline();
  r.move(8);
  assert.ok(r.drainEvents().some((e) => e.type === 'milestone' && e.kind === 'row' && e.index === 2));
});

test('求解器：solveBoard 解 3×3 打乱盘并验证归位', () => {
  const r = createRun(0, { seed: 5 });
  const s = r.state;
  const path = solveBoard(s.cells.slice(), 3);
  assert.ok(path, '3×3 应有解');
  for (const t of path) assert.equal(r.move(t).ok, true);
  for (let i = 0; i < 8; i += 1) assert.equal(s.cells[i], i + 1);
  assert.equal(s.phase, 'won');
});

test('求解器：solveBoard 解 4×4 打乱盘并验证归位', () => {
  const r = createRun(1, { seed: 11 });
  const s = r.state;
  const path = solveBoard(s.cells.slice(), 4);
  assert.ok(path, '4×4 应有解');
  for (const t of path) assert.equal(r.move(t).ok, true);
  for (let i = 0; i < 15; i += 1) assert.equal(s.cells[i], i + 1);
  assert.equal(s.phase, 'won');
});

test('贪心单步：bestMoveIndex 返回合法滑动目标且不增启发式', () => {
  const r = createRun(0, { seed: 3 });
  const s = r.state;
  const t = bestMoveIndex(s.cells, s.size);
  assert.ok(t >= 0 && t !== s.blank);
  const copy = s.cells.slice();
  const nb = applySlide(copy, s.size, s.blank, t);
  assert.equal(copy[nb], 0);
  assert.ok(heuristic(copy, s.size) <= heuristic(s.cells, s.size));
});
