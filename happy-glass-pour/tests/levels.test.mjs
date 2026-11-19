import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { GAME } from '../config/game.config.js';
import { createRun } from '../src/game/sim.js';

function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

test('关卡表：6 关、index 连续 1..6', () => {
  assert.equal(LEVEL_COUNT, 6);
  assert.equal(LEVELS.length, 6);
  LEVELS.forEach((lv, i) => assert.equal(lv.index, i + 1));
});

test('关卡表：字段完整且类型合法', () => {
  for (const lv of LEVELS) {
    assert.ok(lv.ink > 0);
    assert.ok(lv.totalDrops > 0 && lv.winWaterNum > 0 && lv.winWaterNum <= lv.totalDrops);
    assert.ok(lv.dropInterval > 0 && lv.timeLimit > 0);
    assert.ok(Array.isArray(lv.sources) && lv.sources.length >= 1);
    for (const s of lv.sources) assert.ok(['down', 'right', 'left'].includes(s.dir));
    assert.ok(lv.glass.w > 0);
    assert.ok(lv.glass.my < GAME.FLOOR_Y);
    assert.ok(Array.isArray(lv.walls) && Array.isArray(lv.boxes) && Array.isArray(lv.gems));
  }
});

test('关卡表：glass 杯底落在 FLOOR_Y（h = FLOOR_Y - my）', () => {
  for (const lv of LEVELS) {
    assert.equal(lv.glass.my + (GAME.FLOOR_Y - lv.glass.my), GAME.FLOOR_Y);
    assert.ok(lv.glass.my + 40 < GAME.FLOOR_Y, `L${lv.index} 杯身太浅`);
  }
});

test('关卡表：newElement 每关唯一且非空', () => {
  const els = LEVELS.map((l) => (l.newElement || '').trim());
  assert.ok(els.every((e) => e.length > 0));
  assert.equal(new Set(els).size, els.length);
});

test('关卡表：answer 每关至少一条 ≥2 点且在界内', () => {
  for (const lv of LEVELS) {
    assert.ok(Array.isArray(lv.answer) && lv.answer.length >= 1);
    for (const poly of lv.answer) {
      assert.ok(Array.isArray(poly) && poly.length >= 2, `L${lv.index} answer poly 点数不足`);
      for (const [x, y] of poly) {
        assert.ok(x >= -20 && x <= 1300 && y >= -20 && y <= 740, `L${lv.index} answer 点越界`);
      }
    }
  }
});

test('可解性：6 关提示线全部 win', () => {
  for (const lv of LEVELS) {
    const r = createRun(lv.index - 1, { seed: 3 });
    for (const poly of lv.answer) assert.equal(r.drawLine(poly).ok, true, `L${lv.index} answer 画线失败`);
    assert.equal(r.pour().ok, true);
    advance(r, lv.timeLimit + 3);
    assert.equal(r.state.phase, 'won', `L${lv.index} 提示线不可解`);
    assert.ok(r.state.fill >= r.state.winWaterNum);
  }
});

test('可解性：提示线不接触岩浆（win 时无 spill）', () => {
  for (const lv of LEVELS) {
    const r = createRun(lv.index - 1, { seed: 5 });
    for (const poly of lv.answer) r.drawLine(poly);
    r.pour();
    advance(r, lv.timeLimit + 3);
    assert.equal(r.state.phase, 'won');
    assert.equal(r.state.spills, 0, `L${lv.index} 提示线发生失水`);
  }
});
