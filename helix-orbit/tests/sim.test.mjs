import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, step, layerAt, frontCoverage, greedyRotate, effectiveAngle, frontLocal,
} from '../src/game/sim.js';
import {
  normAngle, signedAngle, angleDist, angleInArcs, clamp,
} from '../config/gameplay.js';
import { profileFor, themeFor, THEMES, SEGMENTS } from '../config/levels.js';

// 用一个完全可控的层覆盖指定 index，保证测试确定
function setLayer(run, index, { segments = [], gaps = [], crevice = false, doubleScore = false, crystal = false } = {}) {
  run.layers.set(index, {
    index,
    theme: 0,
    segments,
    gaps,
    baseAngle: 0,
    spin: 0,
    movingOffset: 0,
    reverse: false,
    movingDir: 0,
    movingSpeed: 0,
    crevice,
    doubleScore,
    crystal,
    crystalCollected: false,
  });
}

function stepUntil(run, pred, maxSteps = 6000) {
  let n = 0;
  const seen = [];
  while (n < maxSteps && !pred(run)) {
    run.step({ rotate: 0 });
    for (const e of run.drainEvents()) seen.push(e);
    n += 1;
  }
  return { n, events: seen };
}

// ---------- 纯函数 ----------
test('normAngle 归一化到 [0,2π)', () => {
  assert.equal(normAngle(0), 0);
  assert.equal(normAngle(2 * Math.PI), 0);
  assert.ok(normAngle(-1) > 0 && normAngle(-1) < 2 * Math.PI);
  assert.ok(normAngle(3 * Math.PI) >= 0 && normAngle(3 * Math.PI) < 2 * Math.PI);
});

test('signedAngle 有符号最短角差', () => {
  assert.ok(Math.abs(signedAngle(0, Math.PI / 2) - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(signedAngle(Math.PI, 0)) === Math.PI);
  assert.ok(Math.abs(signedAngle(6.0, 0.1)) < Math.PI);
});

test('angleDist / angleInArcs', () => {
  assert.equal(angleDist(0, 0), 0);
  assert.ok(angleDist(0, Math.PI) === Math.PI);
  assert.equal(angleInArcs(0.5, [{ a0: 0, a1: 1 }]).a0, 0);
  assert.equal(angleInArcs(1.5, [{ a0: 0, a1: 1 }]), null);
});

test('clamp 夹取', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
});

// ---------- 配置 ----------
test('12 段层形配置齐全且各有主题', () => {
  assert.equal(SEGMENTS.length, 12);
  assert.equal(THEMES.length, 3);
  for (let i = 0; i < 12; i += 1) {
    const p = profileFor(i);
    assert.ok(p.gapCount >= 1);
    assert.ok(p.theme >= 0 && p.theme < 3);
    assert.equal(themeFor(i).key, THEMES[p.theme].key);
  }
});

// ---------- 基础 run ----------
test('createRun 初始状态 + 冒烟契约', () => {
  const r = createRun({ seed: 0 });
  assert.equal(r.phase, 'playing');
  assert.equal(r.currentLayer, 0);
  assert.equal(r.ballVy, 0);
  r.step({});
  r.getHud();
  assert.deepEqual(r.drainEvents(), []);
});

test('旋转输入改变塔角', () => {
  const r = createRun({ seed: 1 });
  const a0 = r.towerAngle;
  for (let i = 0; i < 10; i += 1) r.step({ rotate: 1 });
  assert.ok(r.towerAngle !== a0, '塔角应变化');
});

// ---------- 穿落 / 弹跳 / 死亡 ----------
test('正下方是缺口 → 穿落计分', () => {
  const r = createRun({ seed: 2 });
  setLayer(r, 0, { gaps: [{ a0: 0, a1: 1 }] });
  const { events } = stepUntil(r, (x) => x.currentLayer >= 1);
  assert.ok(r.currentLayer >= 1);
  assert.ok(r.score >= 1);
  assert.ok(events.some((e) => e.type === 'layerPass'));
});

test('正下方是安全段 → 弹跳（vy 向上）且连弹计数', () => {
  const r = createRun({ seed: 3 });
  setLayer(r, 0, { segments: [{ a0: 0, a1: 1, magma: false }] });
  const { events } = stepUntil(r, (x) => x.deadlockStreak >= 1);
  assert.ok(r.deadlockStreak >= 1);
  assert.ok(events.some((e) => e.type === 'bounce'));
});

test('正下方是岩浆 → 判负', () => {
  const r = createRun({ seed: 4 });
  setLayer(r, 0, { segments: [{ a0: 0, a1: 1, magma: true }] });
  const { events } = stepUntil(r, (x) => x.phase === 'dead');
  assert.equal(r.phase, 'dead');
  assert.ok(events.some((e) => e.type === 'death'));
});

test('同层同段连弹 ≥3 次 → 卡死判负', () => {
  const r = createRun({ seed: 5 });
  setLayer(r, 0, { segments: [{ a0: 0, a1: 1, magma: false }] });
  stepUntil(r, (x) => x.phase === 'dead');
  assert.equal(r.phase, 'dead');
  assert.equal(r.stats.depth, 0);
});

// ---------- 陨石态 ----------
test('连穿 3 层进入陨石态，并可砸穿岩浆', () => {
  const r = createRun({ seed: 6 });
  setLayer(r, 0, { gaps: [{ a0: 0, a1: 1 }] });
  setLayer(r, 1, { gaps: [{ a0: 0, a1: 1 }] });
  setLayer(r, 2, { gaps: [{ a0: 0, a1: 1 }] });
  setLayer(r, 3, { segments: [{ a0: 0, a1: 1, magma: true }] });
  const { events } = stepUntil(r, (x) => x.currentLayer >= 4);
  assert.ok(events.some((e) => e.type === 'meteorStart'));
  assert.ok(events.some((e) => e.type === 'meteorSmash'));
  assert.equal(r.phase, 'playing');
  assert.ok(r.score >= 8);
});

// ---------- 冰晶冻结 ----------
test('攒满 4 冰晶触发冻结，冻结期岩浆安全', () => {
  const r = createRun({ seed: 7 });
  for (let i = 0; i < 4; i += 1) setLayer(r, i, { gaps: [{ a0: 0, a1: 1 }], crystal: true });
  setLayer(r, 4, { segments: [{ a0: 0, a1: 1, magma: true }] });
  const { events } = stepUntil(r, (x) => x.freezeUntil > x.time && x.currentLayer >= 4);
  assert.ok(events.some((e) => e.type === 'freezeStart'));
  assert.ok(events.some((e) => e.type === 'crystal'));
});

// ---------- 岩芯裂隙 ----------
test('岩芯裂隙层穿落双倍分', () => {
  const r = createRun({ seed: 8 });
  setLayer(r, 0, { gaps: [{ a0: 0, a1: 0.5 }], crevice: true, doubleScore: true });
  stepUntil(r, (x) => x.currentLayer >= 1);
  assert.equal(r.score, 2);
});

// ---------- 贪心策略 ----------
test('greedyRotate 返回 [-1,1] 区间', () => {
  const r = createRun({ seed: 9 });
  for (let i = 0; i < 30; i += 1) {
    const v = greedyRotate(r);
    assert.ok(v >= -1 && v <= 1);
    r.step({ rotate: v });
  }
});

// ---------- 确定性 ----------
test('同 seed 生成相同的层结构', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  const la = layerAt(a, 0);
  const lb = layerAt(b, 0);
  assert.deepEqual(la.gaps, lb.gaps);
  assert.deepEqual(la.segments, lb.segments);
});

// ---------- 角度/覆盖 ----------
test('frontCoverage 正确识别缺口与段', () => {
  const r = createRun({ seed: 10 });
  setLayer(r, 0, { gaps: [{ a0: 0, a1: 1 }] });
  const cov = frontCoverage(r, layerAt(r, 0));
  assert.equal(cov.gap, true);
  setLayer(r, 0, { segments: [{ a0: 0, a1: 1, magma: true }] });
  const cov2 = frontCoverage(r, layerAt(r, 0));
  assert.equal(cov2.gap, false);
  assert.equal(cov2.magma, true);
});
