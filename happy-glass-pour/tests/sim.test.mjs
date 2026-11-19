import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { GAME } from '../config/game.config.js';

function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

function solveLevel(idx, seed = 3) {
  const r = createRun(idx, { seed });
  for (const poly of LEVELS[idx].answer) assert.equal(r.drawLine(poly).ok, true);
  assert.equal(r.pour().ok, true);
  advance(r, LEVELS[idx].timeLimit + 3);
  return r;
}

test('初始状态：phase=draw、墨水满、fill=0', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.state.phase, 'draw');
  assert.equal(r.state.level, 1);
  assert.equal(r.state.ink, r.state.inkMax);
  assert.equal(r.state.fill, 0);
});

test('drawLine 消耗墨水并提交一条轨道', () => {
  const r = createRun(0, { seed: 1 });
  const before = r.state.ink;
  const res = r.drawLine([[100, 200], [300, 200]]);
  assert.equal(res.ok, true);
  assert.equal(r.state.lines.length, 1);
  assert.ok(r.state.ink < before);
});

test('drawLine 校验：点数不足 / 无墨水 / 非 draw 阶段', () => {
  const r = createRun(0, { seed: 1 });
  assert.deepEqual(r.drawLine([[10, 10]]), { ok: false, reason: 'points' });
  r.state.ink = 0;
  assert.deepEqual(r.drawLine([[10, 10], [20, 20]]), { ok: false, reason: 'ink' });
  r.state.ink = 100;
  r.state.phase = 'pour';
  assert.deepEqual(r.drawLine([[10, 10], [20, 20]]), { ok: false, reason: 'phase' });
});

test('beginStroke / strokeTo / endStroke 三段式画线', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.beginStroke(100, 100).ok, true);
  assert.equal(r.strokeTo(200, 120).ok, true);
  assert.equal(r.strokeTo(300, 100).ok, true);
  assert.equal(r.endStroke().ok, true);
  assert.equal(r.state.lines.length, 1);
  assert.equal(r.state.lines[0].pts.length, 3);
});

test('最多画 MAX_LINES 条线，超过被拒', () => {
  const r = createRun(0, { seed: 1 });
  for (let i = 0; i < GAME.MAX_LINES; i += 1) {
    assert.equal(r.drawLine([[10, 10 + i], [40, 10 + i]]).ok, true);
  }
  assert.deepEqual(r.drawLine([[10, 900], [40, 900]]), { ok: false, reason: 'lines' });
});

test('pour 进入 pour 阶段；非 draw 阶段被拒', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.pour().ok, true);
  assert.equal(r.state.phase, 'pour');
  assert.deepEqual(r.pour(), { ok: false, reason: 'phase' });
});

test('step 推进时间；无输入时水滴落入岩浆判负', () => {
  const r = createRun(0, { seed: 1 });
  r.pour();
  advance(r, 4);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'spill');
  assert.ok(r.state.spills >= 1);
});

test('平轨兜住水 → 超时判负', () => {
  const r = createRun(0, { seed: 1 });
  r.drawLine([[100, 300], [1180, 300]]);
  r.pour();
  advance(r, LEVELS[0].timeLimit + 2);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'timeOut');
});

test('L1 提示线可解：win + fill≥winWaterNum + 3 星', () => {
  const r = solveLevel(0);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.result.won, true);
  assert.ok(r.state.fill >= r.state.winWaterNum);
  assert.equal(r.state.stars, 3);
});

test('L3 提示线收集全部宝石', () => {
  const r = solveLevel(2);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.gems.filter((g) => g.collected).length, 2);
  assert.equal(r.state.stars, 3);
});

test('L5 双喷口提示线可解', () => {
  const r = solveLevel(4);
  assert.equal(r.state.phase, 'won');
  assert.ok(r.state.fill >= r.state.winWaterNum);
});

test('连击：连续入杯产生 maxCombo≥2', () => {
  const r = solveLevel(0);
  assert.ok(r.state.maxCombo >= 2);
});

test('事件：drainEvents 吐出 draw/pour/win 等', () => {
  const r = createRun(0, { seed: 1 });
  r.drawLine([[150, 240], [940, 520]]);
  r.pour();
  advance(r, LEVELS[0].timeLimit + 2);
  const ev = r.drainEvents();
  const types = new Set(ev.map((e) => e.type));
  assert.ok(types.has('draw'));
  assert.ok(types.has('pour'));
  assert.ok(types.has('dropSpawn'));
  assert.ok(types.has('dropCollect'));
  assert.ok(types.has('win'));
});

test('getHud 形状与数值一致', () => {
  const r = createRun(0, { seed: 1 });
  const h = r.getHud();
  assert.equal(h.level, 1);
  assert.equal(h.phase, 'draw');
  assert.equal(h.inkMax, r.state.inkMax);
  assert.equal(h.fill, 0);
});

test('确定性：同 seed 两局首滴 x 一致', () => {
  const a = createRun(0, { seed: 42 });
  const b = createRun(0, { seed: 42 });
  a.pour(); b.pour();
  a.step(1 / 60); b.step(1 / 60);
  assert.equal(a.state.drops[0].x, b.state.drops[0].x);
});

test('mulberry32 输出 [0,1) 且确定', () => {
  const f = mulberry32(7);
  const v1 = f();
  const v2 = f();
  const g = mulberry32(7);
  assert.equal(v1, g());
  assert.equal(v2, g());
  assert.ok(v1 >= 0 && v1 < 1);
});
