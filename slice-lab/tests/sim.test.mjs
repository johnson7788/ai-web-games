import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, evaluateCut, splitPolygon, polygonArea, segmentPolygonHits,
  segmentPointDistance, mulberry32, BISECT_DIRECTIONS,
} from '../src/game/sim.js';
import { PASS_SCORE, SETTLE_SEC } from '../config/game.config.js';
import { LEVEL_COUNT, LEVELS } from '../config/levels.js';

const square = [
  { x: 50, y: 50 },
  { x: 150, y: 50 },
  { x: 150, y: 150 },
  { x: 50, y: 150 },
];

test('polygonArea：正方形面积正确', () => {
  assert.equal(polygonArea(square), 10000);
});

test('polygonArea：退化输入返回 0', () => {
  assert.equal(polygonArea([]), 0);
  assert.equal(polygonArea([{ x: 0, y: 0 }, { x: 1, y: 1 }]), 0);
});

test('splitPolygon：竖直线把正方形切成两个矩形', () => {
  const { A, B } = splitPolygon(square, { x: 100, y: 0 }, { x: 100, y: 200 });
  assert.equal(A.length, 4);
  assert.equal(B.length, 4);
  assert.ok(Math.abs(polygonArea(A) - 5000) < 1);
  assert.ok(Math.abs(polygonArea(B) - 5000) < 1);
});

test('segmentPolygonHits：穿越正方形的线段恰好 2 个交点', () => {
  const hits = segmentPolygonHits(100, 0, 100, 200, square);
  assert.equal(hits.length, 2);
});

test('segmentPointDistance：点在线段上距离为 0', () => {
  assert.equal(segmentPointDistance({ x: 100, y: 100 }, { x: 100, y: 0 }, { x: 100, y: 200 }), 0);
});

test('evaluateCut：正方形中线等分 → 100 分', () => {
  const r = evaluateCut(square, null, 100, 0, 100, 200);
  assert.ok(r.valid);
  assert.equal(r.score, 100);
});

test('evaluateCut：岩核挡住中线 → reason rock', () => {
  const rock = { x: 100, y: 100, r: 20 };
  const r = evaluateCut(square, rock, 100, 0, 100, 200);
  assert.ok(!r.valid);
  assert.equal(r.reason, 'rock');
});

test('createRun：初始化 drawing + 第 1 关 + 有 levelStart 事件', () => {
  const run = createRun(0, { seed: 7 });
  assert.equal(run.state.level, 1);
  assert.equal(run.state.phase, 'drawing');
  const events = run.drainEvents();
  assert.equal(events[0].type, 'levelStart');
});

test('createRun：固定 seed 生成确定形状', () => {
  const a = createRun(0, { seed: 42 });
  const b = createRun(0, { seed: 42 });
  assert.deepEqual(a.state.shape, b.state.shape);
});

test('createRun：不同 seed 形状不同', () => {
  const a = createRun(0, { seed: 1 });
  const b = createRun(0, { seed: 2 });
  assert.notDeepEqual(a.state.shape, b.state.shape);
});

test('cut：等分线切开后 settle → won 且 score ≥ PASS_SCORE', () => {
  const run = createRun(0, { seed: 11 });
  let line = null;
  for (const d of BISECT_DIRECTIONS) {
    const l = run.bisect(d);
    if (l) { line = l; break; }
  }
  assert.ok(line, '应找到一条等分线');
  const res = run.cut(line.p1.x, line.p1.y, line.p2.x, line.p2.y);
  assert.ok(res.ok);
  assert.equal(run.state.phase, 'splitting');
  assert.equal(run.state.pieces.length, 2);
  run.step(SETTLE_SEC + 0.1);
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.score >= PASS_SCORE);
  assert.ok(run.state.stars >= 1);
});

test('cut：切开后事件包含 cut / split / settle / win', () => {
  const run = createRun(0, { seed: 5 });
  run.drainEvents();
  let line = null;
  for (const d of BISECT_DIRECTIONS) {
    const l = run.bisect(d);
    if (l) { line = l; break; }
  }
  run.cut(line.p1.x, line.p1.y, line.p2.x, line.p2.y);
  run.step(SETTLE_SEC + 0.1);
  const types = run.drainEvents().map((e) => e.type);
  for (const t of ['cut', 'split', 'settle', 'win']) assert.ok(types.includes(t), `缺事件 ${t}`);
});

test('cut：切空（不穿越）→ miss 且不改变 phase', () => {
  const run = createRun(0, { seed: 9 });
  const res = run.cut(0, 0, 20, 0); // 远离水晶
  assert.ok(!res.ok);
  assert.equal(res.reason, 'miss');
  assert.equal(run.state.phase, 'drawing');
});

test('noinput：倒计时耗尽 → lost(timeout)', () => {
  const run = createRun(0, { seed: 3 });
  for (let i = 0; i < 60 * 40; i += 1) run.step(1 / 60);
  assert.equal(run.state.phase, 'lost');
  const events = run.drainEvents().map((e) => e.type);
  assert.ok(events.includes('lose'));
});

test('连击：连续两关都过关后 combo 递增并发出 combo 事件', () => {
  const r1 = createRun(0, { seed: 5, combo: 0 });
  r1.drainEvents();
  let l = null;
  for (const d of BISECT_DIRECTIONS) { const x = r1.bisect(d); if (x) { l = x; break; } }
  r1.cut(l.p1.x, l.p1.y, l.p2.x, l.p2.y);
  r1.step(SETTLE_SEC + 0.1);
  assert.equal(r1.state.phase, 'won');
  const combo1 = r1.state.combo;
  assert.equal(combo1, 1);

  const r2 = createRun(1, { seed: 6, combo: combo1 });
  r2.drainEvents();
  l = null;
  for (const d of BISECT_DIRECTIONS) { const x = r2.bisect(d); if (x) { l = x; break; } }
  r2.cut(l.p1.x, l.p1.y, l.p2.x, l.p2.y);
  r2.step(SETTLE_SEC + 0.1);
  assert.equal(r2.state.phase, 'won');
  assert.equal(r2.state.combo, 2);
  assert.ok(r2.drainEvents().some((e) => e.type === 'combo'));
});

test('preview：不落地状态，可预测均分', () => {
  const run = createRun(0, { seed: 13 });
  const before = run.state.phase;
  const p = run.preview(0, 0, 1280, 720);
  assert.equal(run.state.phase, before);
  assert.ok(p === null || typeof p.score === 'number' || p.reason);
});

test('关卡表：共 12 关且每关 name 都有 en/zh', () => {
  assert.equal(LEVEL_COUNT, 12);
  for (const lv of LEVELS) {
    assert.ok(lv.name.en && lv.name.zh);
    assert.ok(lv.minVerts <= lv.maxVerts);
    assert.ok(lv.time > 0);
  }
});

test('mulberry32：确定性序列', () => {
  const a = mulberry32(99);
  const b = mulberry32(99);
  assert.equal(a(), b());
  assert.equal(a(), b());
});
