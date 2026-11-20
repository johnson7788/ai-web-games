import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32, gateGeometry } from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';

function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

function simpleGate(over = {}) {
  return {
    x: 300, baseCenter: 400, gapH: 240, double: false,
    moveAmp: 0, movePhase: 0, moveFreq: 1.1, passed: false, pearls: [],
    ...over,
  };
}

test('冒烟：createRun → step → flap → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  r.step(1 / 60);
  assert.equal(r.state.phase, 'playing');
  assert.equal(r.flap().ok, true);
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.targetGates, 3);
  assert.ok(Array.isArray(r.drainEvents()));
});

test('state 形状：level/koi/targetGates/waterY/sceneKey', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.sceneKey, 'dawn');
  assert.equal(s.koi.x, GAME.KOI_X);
  assert.equal(s.koi.r, GAME.KOI_R);
  assert.equal(s.targetGates, 3);
  assert.equal(s.waterY, GAME.WATER_BASE);
});

test('flap 物理：上扑后 vy<0 且 started=true', () => {
  const r = createRun(0, { seed: 1 });
  r.flap();
  assert.equal(r.state.started, true);
  assert.ok(r.state.koi.vy < 0);
});

test('重力：start 后无输入会下落', () => {
  const r = createRun(0, { seed: 1 });
  r.start();
  const y0 = r.state.koi.y;
  advance(r, 0.2);
  assert.ok(r.state.koi.y > y0);
});

test('门柱生成：start 后出现门，且门数 ≥1', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.state.gates.length, 0);
  r.start();
  assert.ok(r.state.gates.length >= 1);
});

test('gateGeometry：单门缝上下缘', () => {
  const geo = gateGeometry({ baseCenter: 400, gapH: 240, double: false, moveAmp: 0 }, 0);
  assert.equal(geo.gaps.length, 1);
  assert.equal(geo.gaps[0].top, 280);
  assert.equal(geo.gaps[0].bottom, 520);
});

test('gateGeometry：双门两缝', () => {
  const geo = gateGeometry({ baseCenter: 400, gapH: 240, double: true, moveAmp: 0 }, 0);
  assert.equal(geo.gaps.length, 2);
});

test('gateGeometry：移动门随时间改变门缝', () => {
  const g = { baseCenter: 400, gapH: 240, double: false, moveAmp: 70, movePhase: 0, moveFreq: 1 };
  const a = gateGeometry(g, 0).gaps[0].top;
  const b = gateGeometry(g, Math.PI / 2).gaps[0].top;
  assert.ok(b > a);
});

test('mulberry32 可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test('穿门得分：门越过锦鲤后 score+1', () => {
  const r = createRun(0, { seed: 1 });
  r.start();
  r.state.gates = [simpleGate({ x: -100 }), simpleGate({ x: 1700, baseCenter: 360 })];
  advance(r, 0.05);
  assert.ok(r.state.score >= 1);
});

test('通关：达到目标门数 → won 且 stars≥1', () => {
  const r = createRun(0, { seed: 1 });
  r.start();
  r.state.score = r.state.targetGates - 1;
  r.state.gates = [simpleGate({ x: -100 }), simpleGate({ x: 1700, baseCenter: 360 })];
  advance(r, 0.05);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.result.won, true);
  assert.ok(r.state.stars >= 1);
});

test('珍珠收集：重叠即得珍珠', () => {
  const r = createRun(1, { seed: 1 });
  r.start();
  r.state.gates = [simpleGate({ x: r.state.koi.x, baseCenter: r.state.koi.y, pearls: [{ gap: 0, rel: 0, taken: false, r: 11 }] })];
  advance(r, 0.05);
  assert.equal(r.state.pearls, 1);
});

test('升星：吃满 3 颗珍珠发 star 事件', () => {
  const r = createRun(1, { seed: 1 });
  r.start();
  r.state.pearls = 2;
  r.state.gates = [simpleGate({ x: r.state.koi.x, baseCenter: r.state.koi.y, pearls: [{ gap: 0, rel: 0, taken: false, r: 11 }] })];
  advance(r, 0.05);
  assert.equal(r.state.pearls, 3);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'star' && e.reason === 'pearl'));
});

test('鳞光冲刺：dash 关第 3 颗珍珠触发 scaleDash + shimmer', () => {
  const r = createRun(10, { seed: 1 }); // L11 dash
  r.start();
  r.state.pearls = 2;
  r.state.gates = [simpleGate({ x: r.state.koi.x, baseCenter: r.state.koi.y, pearls: [{ gap: 0, rel: 0, taken: false, r: 11 }] })];
  advance(r, 0.05);
  assert.ok(r.state.shimmer > 0);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'scaleDash'));
});

test('水花连跳：贴水轻缓下落触发免费小跳', () => {
  const r = createRun(0, { seed: 1 });
  r.start();
  r.state.koi.y = GAME.WATER_BASE - 40;
  r.state.koi.vy = 50;
  r.step(1 / 60);
  assert.ok(r.state.skimJumps >= 1);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'waterSplash'));
});

test('落水判负：俯冲入水 → lost water', () => {
  const r = createRun(0, { seed: 1 });
  r.start();
  r.state.koi.y = GAME.WATER_BASE - 10;
  r.state.koi.vy = 300;
  advance(r, 0.05);
  assert.equal(r.state.phase, 'lost');
  assert.ok(r.state.result.won === false);
});

test('撞柱判负：压上门柱 → lost gate', () => {
  const r = createRun(0, { seed: 1 });
  r.start();
  r.state.koi.y = 100;
  r.state.koi.vy = 0;
  r.state.gates = [simpleGate({ x: r.state.koi.x })];
  advance(r, 0.05);
  assert.equal(r.state.phase, 'lost');
});

test('noinput 基线：start 后无操作会死', () => {
  const r = createRun(0, { seed: 1 });
  r.start();
  advance(r, 3);
  assert.equal(r.state.phase, 'lost');
});

test('顶部钳制：飞过头不判负，只是 clamp', () => {
  const r = createRun(0, { seed: 1 });
  r.start();
  r.state.koi.y = 5;
  r.state.koi.vy = -500;
  advance(r, 0.05);
  assert.ok(r.state.koi.y >= GAME.CEILING);
  assert.equal(r.state.phase, 'playing');
});

test('事件：开局发 levelStart，生成门发 gateApproach', () => {
  const r = createRun(0, { seed: 1 });
  assert.ok(r.drainEvents().some((e) => e.type === 'levelStart'));
  r.start();
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'gateApproach'));
});

test('侧风：wind 关发 windGust 事件', () => {
  const r = createRun(4, { seed: 1 }); // L5 wind
  r.start();
  let saw = false;
  for (let i = 0; i < 60 * 3 && !saw; i += 1) {
    if (r.state.koi.y > 320) r.flap();
    r.step(1 / 60);
    saw = r.drainEvents().some((e) => e.type === 'windGust');
  }
  assert.ok(saw);
});

test('巨浪：wave 关改变 waterY', () => {
  const r = createRun(6, { seed: 1 }); // L7 wave
  r.start();
  const y0 = r.state.waterY;
  advance(r, 0.5);
  assert.notEqual(r.state.waterY, y0);
});
