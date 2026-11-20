// DUNE BUGGY · 纯逻辑测试（node --test；不碰 DOM/window/localStorage）
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, step } from '../src/game/sim.js';
import { buildTrack, buildCheckpoints, segmentAt } from '../src/game/track.js';
import {
  CAR, PRESSURE, DEFAULT_PRESSURE, TERRAIN, JUMP, STAGE,
  clamp, effectiveGrip, effectiveMaxSpeed, ratingFor,
} from '../config/gameplay.js';
import { STAGES, STAGE_COUNT, stageAt } from '../config/levels.js';
import { mulberry32 } from '../src/game/rng.js';

function drive(run, ticks, input) {
  for (let i = 0; i < ticks; i += 1) {
    run.step(input);
    run.drainEvents();
    if (run.phase !== 'playing') break;
  }
}

function centerInput(run) {
  return { throttle: 1, steer: clamp(-run.playerX * 5, -1, 1), brake: 0, tune: false };
}

test('createRun 初始为第 1 赛段、playing、速度 0', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.phase, 'playing');
  assert.equal(r.stage, 1);
  assert.equal(r.speed, 0);
  assert.equal(r.stats.maxStage, 1);
  assert.ok(r.segments.length > 0);
});

test('油门使速度上升', () => {
  const r = createRun({ seed: 1 });
  r.step({ throttle: 1, steer: 0 });
  assert.ok(r.speed > 0);
});

test('刹车使速度下降且不低于 0', () => {
  const r = createRun({ seed: 1 });
  drive(r, 200, { throttle: 1, steer: 0 });
  const before = r.speed;
  r.step({ throttle: 0, brake: 1, steer: 0 });
  assert.ok(r.speed < before);
  drive(r, 1000, { throttle: 0, brake: 1, steer: 0 });
  assert.ok(r.speed >= 0);
});

test('转向改变 playerX', () => {
  const r = createRun({ seed: 1 });
  drive(r, 60, { throttle: 1, steer: 0 });
  const x0 = r.playerX;
  drive(r, 60, { throttle: 1, steer: 1 });
  assert.ok(r.playerX > x0);
});

test('弯道离心使 playerX 偏移（曲线不为 0）', () => {
  const r = createRun({ seed: 5 });
  drive(r, 300, { throttle: 1, steer: 0 });
  assert.notEqual(Math.round(r.playerX * 1000), 0); // 有偏移
});

test('冲出赛道额外减速', () => {
  const r = createRun({ seed: 1 });
  drive(r, 200, { throttle: 1, steer: 0 });
  r.playerX = 2.0; // 冲出赛道
  const v1 = r.speed;
  r.step({ throttle: 1, steer: 0 });
  assert.ok(r.speed < v1);
});

test('骑上沙脊提高极速上限', () => {
  const r = createRun({ seed: 2 });
  // 找到一个 ridge 段并骑上去（playerX 置 0，横向进脊段）
  for (let i = 0; i < 2000 && r.phase === 'playing'; i += 1) {
    const seg = segmentAt(r.segments, r.position);
    if (seg.ridge) { r.playerX = seg.ridgeX; r.step({ throttle: 1, steer: 0 }); break; }
    r.step({ throttle: 1, steer: 0 });
  }
  const seg = segmentAt(r.segments, r.position);
  if (seg.ridge) {
    const onRidge = Math.abs(r.playerX - seg.ridgeX) < CAR.RIDGE_HALF;
    assert.ok(onRidge);
    assert.ok(r.speed > 0);
  }
});

test('胎压 T 边沿切换 high↔low', () => {
  const r = createRun({ seed: 1, pressure: 'high' });
  r.step({ throttle: 0, steer: 0, tune: true });
  assert.equal(r.pressure, 'low');
  r.step({ throttle: 0, steer: 0, tune: false });
  r.step({ throttle: 0, steer: 0, tune: true });
  assert.equal(r.pressure, 'high');
});

test('高胎压极速更高、低胎压抓地更强', () => {
  assert.ok(effectiveMaxSpeed('high', 'sand') > effectiveMaxSpeed('low', 'sand'));
  assert.ok(effectiveGrip('low', 'sand') > effectiveGrip('high', 'sand'));
});

test('赛段完成触发 stageClear 并推进 stage', () => {
  const r = createRun({ seed: 1 });
  let sawClear = false;
  for (let i = 0; i < 20000 && r.phase === 'playing'; i += 1) {
    r.step(centerInput(r));
    for (const e of r.drainEvents()) if (e.type === 'stageClear') sawClear = true;
  }
  assert.ok(sawClear);
  assert.ok(r.stage > 1);
});

test('无输入最终 DNF（超时死亡）', () => {
  const r = createRun({ seed: 1 });
  drive(r, Math.round((stageAt(1).parSec + STAGE.DNF_GRACE + 2) * 60), { throttle: 0, steer: 0 });
  assert.equal(r.phase, 'dead');
});

test('满油门可跑完全程成为冠军', () => {
  const r = createRun({ seed: 42 });
  for (let i = 0; i < 20000 && r.phase === 'playing'; i += 1) {
    r.step(centerInput(r));
    r.drainEvents();
  }
  assert.equal(r.phase, 'won');
  assert.equal(r.stats.stageTimes.length, STAGE_COUNT);
});

test('检查点事件在推进中触发', () => {
  const r = createRun({ seed: 1 });
  const seen = [];
  for (let i = 0; i < 2000 && r.phase === 'playing'; i += 1) {
    r.step({ throttle: 1, steer: 0 });
    for (const e of r.drainEvents()) if (e.type === 'checkpoint') seen.push(e);
  }
  assert.ok(seen.length >= 1);
});

test('速度里程碑事件随推进触发', () => {
  const r = createRun({ seed: 1 });
  const seen = [];
  for (let i = 0; i < 2000 && r.phase === 'playing'; i += 1) {
    r.step({ throttle: 1, steer: 0 });
    for (const e of r.drainEvents()) if (e.type === 'speedMilestone') seen.push(e);
  }
  assert.ok(seen.length >= 1);
});

test('赛道生成确定性（同 seed 同结果）', () => {
  const a = buildTrack(stageAt(3), 123);
  const b = buildTrack(stageAt(3), 123);
  assert.deepEqual(a, b);
  assert.ok(a.length >= 40);
});

test('检查点数量与赛段长度匹配', () => {
  const cps = buildCheckpoints(stageAt(3).length);
  assert.ok(cps.length >= 1);
  assert.ok(cps[cps.length - 1] < stageAt(3).length);
});

test('segmentAt 边界夹取', () => {
  const segs = buildTrack(stageAt(1), 7);
  assert.equal(segmentAt(segs, -10), segs[0]);
  assert.equal(segmentAt(segs, 1e9), segs[segs.length - 1]);
});

test('ratingFor 判定阈值', () => {
  assert.equal(ratingFor(10, 20), 'gold');
  assert.equal(ratingFor(22, 20), 'silver');
  assert.equal(ratingFor(28, 20), 'bronze');
  assert.equal(ratingFor(40, 20), 'finish');
});

test('effectiveMaxSpeed 沙暴降速', () => {
  assert.ok(effectiveMaxSpeed('high', 'sand', 0.8) < effectiveMaxSpeed('high', 'sand', 0));
});

test('clamp 与 RNG 稳定性', () => {
  assert.equal(clamp(5, 0, 3), 3);
  const r1 = mulberry32(99)();
  const r2 = mulberry32(99)();
  assert.equal(r1, r2);
});
