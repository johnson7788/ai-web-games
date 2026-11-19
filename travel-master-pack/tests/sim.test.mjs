// Travel Master Pack · sim 纯逻辑测试（node --test）
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32, speedOf } from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';

const DT = 1 / 60;

function step(run, n) {
  for (let i = 0; i < n; i += 1) run.step(DT);
}

function inject(run, kind, lane, y = GAME.PLAYER_Y - GAME.PLAYER_BAND - 2) {
  run.state.entities.push({
    kind, lane, thing: 0, y,
    speed: (GAME.END_Y - GAME.SPAWN_Y) / Math.max(0.05, run.state.fallTime),
    resolved: false, removed: false, passed: false,
  });
}

function disableSpawn(run) {
  run.state.spawnInterval = 1e9;
  run.state.spawnAcc = 0;
}

function drain(run) {
  return run.drainEvents();
}

test('初始状态', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.lane, 1);
  assert.equal(run.state.score, 0);
  assert.equal(run.state.comboMult, 1);
  assert.equal(run.state.shield, 0);
});

test('换道与边界', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.move(1).ok, true);
  assert.equal(run.state.lane, 2);
  assert.equal(run.move(-1).ok, true);
  assert.equal(run.state.lane, 1);
  run.state.lane = 0;
  assert.equal(run.move(-1).ok, false);
  run.state.lane = 3;
  assert.equal(run.move(1).ok, false);
});

test('随时间生成路障', () => {
  const run = createRun({ seed: 2 });
  step(run, 200); // ~3.3s
  const evs = drain(run);
  assert.ok(run.state.entities.some((e) => e.kind === 'barrier'));
  assert.ok(evs.some((e) => e.type === 'spawn' && e.kind === 'barrier'));
});

test('闪避路障 +1 分', () => {
  const run = createRun({ seed: 3 });
  disableSpawn(run);
  inject(run, 'barrier', 0); // 玩家在车道 1
  step(run, 400);
  drain(run);
  assert.equal(run.state.score, 1);
  assert.equal(run.state.stats.dodged, 1);
  assert.equal(run.state.phase, 'playing');
});

test('接包裹 +2 分且连击 +1', () => {
  const run = createRun({ seed: 4 });
  disableSpawn(run);
  inject(run, 'goods', 1);
  step(run, 60);
  const evs = drain(run);
  assert.equal(run.state.score, 2);
  assert.equal(run.state.combo, 1);
  assert.equal(run.state.stats.collected, 1);
  assert.ok(evs.some((e) => e.type === 'collect'));
});

test('漏包裹清零连击', () => {
  const run = createRun({ seed: 5 });
  disableSpawn(run);
  run.state.combo = 5;
  run.state.comboMult = 2;
  inject(run, 'goods', 0); // 玩家在车道 1，漏接
  step(run, 400);
  const evs = drain(run);
  assert.equal(run.state.combo, 0);
  assert.equal(run.state.comboMult, 1);
  assert.equal(run.state.stats.missed, 1);
  assert.ok(evs.some((e) => e.type === 'miss'));
});

test('接护盾', () => {
  const run = createRun({ seed: 6 });
  disableSpawn(run);
  inject(run, 'shield', 1);
  step(run, 60);
  drain(run);
  assert.equal(run.state.shield, 1);
  assert.equal(run.state.stats.shieldsGot, 1);
});

test('护盾挡一次撞击', () => {
  const run = createRun({ seed: 7 });
  disableSpawn(run);
  run.state.shield = 1;
  inject(run, 'barrier', 1);
  step(run, 40);
  const evs = drain(run);
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.shield, 0);
  assert.ok(evs.some((e) => e.type === 'shieldBlock'));
});

test('无护盾撞击即败', () => {
  const run = createRun({ seed: 8 });
  disableSpawn(run);
  inject(run, 'barrier', 1);
  step(run, 40);
  const evs = drain(run);
  assert.equal(run.state.phase, 'over');
  assert.ok(evs.some((e) => e.type === 'lose'));
  assert.equal(run.state.result.reason, 'crash');
});

test('连击升档（10 连击 → ×2）', () => {
  const run = createRun({ seed: 9 });
  disableSpawn(run);
  run.state.combo = 9;
  inject(run, 'barrier', 0);
  step(run, 400);
  const evs = drain(run);
  assert.equal(run.state.combo, 10);
  assert.equal(run.state.comboMult, 2);
  assert.ok(evs.some((e) => e.type === 'combo'));
});

test('每 20 分升级', () => {
  const run = createRun({ seed: 10 });
  disableSpawn(run);
  run.state.score = 19;
  inject(run, 'barrier', 0);
  step(run, 400);
  const evs = drain(run);
  assert.equal(run.state.level, 2);
  assert.ok(evs.some((e) => e.type === 'levelUp'));
});

test('速度曲线 P0 1:1', () => {
  assert.deepEqual(speedOf(5), { interval: 1500, fall: 5 });
  assert.deepEqual(speedOf(10), { interval: 1000, fall: 4.7 });
  assert.deepEqual(speedOf(20), { interval: 950, fall: 4.4 });
  assert.deepEqual(speedOf(1000), { interval: 50, fall: 0.5 });
});

test('单车道最多连续 3 个路障', () => {
  const run = createRun({ seed: 11 });
  run.state.entities = [];
  run.state.spawnInterval = 1e9;
  // 连续生成 40 个路障，检查任一车道不会出现第 4 个连续
  let ok = true;
  for (let i = 0; i < 40; i += 1) {
    run._spawnBarrier();
  }
  const lanes = run.state.entities.filter((e) => e.kind === 'barrier').map((e) => e.lane);
  let streak = 1;
  for (let i = 1; i < lanes.length; i += 1) {
    if (lanes[i] === lanes[i - 1]) streak += 1; else streak = 1;
    if (streak > GAME.MAX_BARRIER_STREAK) { ok = false; break; }
  }
  assert.equal(ok, true);
});

test('同 seed 可复现', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  step(a, 100);
  step(b, 100);
  assert.deepEqual(a.state.entities.map((e) => [e.kind, e.lane]), b.state.entities.map((e) => [e.kind, e.lane]));
});

test('mulberry32 稳定', () => {
  const r = mulberry32(123);
  const r2 = mulberry32(123);
  assert.equal(r(), r2());
});
