import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { CORE, PHOTON, slotHalf, angDist, normAngle } from '../config/gameplay.js';
import { RING_COUNT, ringAt } from '../config/levels.js';

// ---------- 工具 ----------
function stepN(run, n, input = {}) {
  for (let i = 0; i < n; i += 1) run.step(input);
}

function fireAndLand(run) {
  run.step({ fire: true });
  for (let i = 0; i < 80 && run.photon && run.phase === 'playing'; i += 1) run.step({ fire: false });
}

function types(events) {
  return events.map((e) => e.type);
}

function addPinnedAtBottom(run, heavy = false) {
  const core = run.cores[0];
  core.omegaBase = 0; // 停转，保证钉在底部不动
  run.pinned.push({
    id: run.nextId++,
    coreId: core.id,
    slot: Math.PI / 2, // 世界角 = rotation + slot = π/2（正下方）
    r: heavy ? PHOTON.HEAVY_R : PHOTON.R,
    heavy,
    value: heavy ? 2 : 1,
  });
}

// ---------- 初始状态 / 契约 ----------
test('createRun 初始状态符合契约', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.ring, 1);
  assert.equal(run.ringPinned, 0);
  assert.equal(run.ringTarget, 8);
  assert.equal(run.cores.length, 1);
  assert.equal(run.cores[0].form, 'single');
  assert.deepEqual(run.drainEvents(), []);
});

test('getHud 契约字段齐全且 sceneKey 是 i18n key', () => {
  const run = createRun({ seed: 2 });
  const hud = run.getHud();
  assert.deepEqual(Object.keys(hud).sort(), [
    'combo', 'nextHeavy', 'omega', 'phase', 'ring', 'ringPinned', 'ringTarget', 'ringTotal', 'scene', 'sceneKey', 'sceneLabel', 'score',
  ]);
  assert.equal(hud.sceneKey, 'scene.blue');
  assert.equal(hud.ringTotal, 12);
  assert.equal(hud.phase, 'playing');
});

test('同 seed 同输入 → 同结果（确定性）', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  for (let i = 0; i < 200; i += 1) {
    const fire = i % 30 === 0;
    a.step({ fire });
    b.step({ fire });
  }
  assert.equal(a.time, b.time);
  assert.equal(a.pinned.length, b.pinned.length);
  assert.equal(a.score, b.score);
  assert.equal(a.ring, b.ring);
  assert.deepEqual(a.drainEvents().map((e) => e.type), b.drainEvents().map((e) => e.type));
});

// ---------- 发射 / 钉入 ----------
test('发射光子直线飞行并钉到能量核上', () => {
  const run = createRun({ seed: 3 });
  fireAndLand(run);
  assert.equal(run.pinned.length, 1);
  assert.equal(run.ringPinned, 1);
  assert.equal(run.photon, null);
  assert.ok(types(run.drainEvents()).includes('pin'));
});

test('钉入累计到目标后清环并推进到下一环', () => {
  const run = createRun({ seed: 4 });
  run.ringTarget = 1;
  fireAndLand(run);
  assert.equal(run.ring, 2);
  assert.equal(run.ringPinned, 0);
  assert.equal(run.pinned.length, 0);
  assert.ok(types(run.drainEvents()).includes('ringClear'));
});

test('清环会切换场景（蓝 → 红）', () => {
  const run = createRun({ seed: 5, startRing: 4 });
  run.ringTarget = 1;
  fireAndLand(run);
  assert.equal(run.ring, 5);
  assert.equal(run.getHud().scene, 'red');
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'sceneEnter' && e.scene === 1));
});

test('第 12 环清空 → 通关 win', () => {
  const run = createRun({ seed: 6, startRing: 12 });
  run.ringTarget = 1;
  fireAndLand(run);
  assert.equal(run.phase, 'won');
  assert.ok(types(run.drainEvents()).includes('win'));
});

test('无输入基线：不会死亡、不会自动推进钉数', () => {
  const run = createRun({ seed: 7 });
  stepN(run, 120);
  assert.equal(run.phase, 'playing');
  assert.equal(run.pinned.length, 0);
  assert.equal(run.ring, 1);
});

// ---------- 碰撞 / 判负 / 护盾 / grace ----------
test('光子撞到已钉光子 → 判负', () => {
  const run = createRun({ seed: 8 });
  addPinnedAtBottom(run);
  run.step({ fire: true });
  stepN(run, 40);
  assert.equal(run.phase, 'dead');
  assert.ok(types(run.drainEvents()).includes('death'));
});

test('护盾升级：每环第一次碰撞被抵消', () => {
  const run = createRun({ seed: 9 });
  run.mods.shield = true;
  addPinnedAtBottom(run);
  run.step({ fire: true });
  stepN(run, 40);
  assert.equal(run.phase, 'playing', '第一次碰撞被抵消');
  assert.ok(types(run.drainEvents()).includes('shieldSave'));

  addPinnedAtBottom(run);
  run.step({ fire: true });
  stepN(run, 40);
  assert.equal(run.phase, 'dead', '第二次碰撞不再抵消');
});

test('grace 升级：每环开局 2.5s 内碰撞不判负', () => {
  const run = createRun({ seed: 10 });
  run.mods.grace = true;
  addPinnedAtBottom(run);
  run.step({ fire: true });
  stepN(run, 40);
  assert.equal(run.phase, 'playing');
  assert.ok(types(run.drainEvents()).includes('shieldSave'));
});

// ---------- 重光子 / 过载 ----------
test('重光子飞行钉入：半径更大、占 2 钉进度', () => {
  const run = createRun({ seed: 11 });
  run.nextHeavy = true;
  fireAndLand(run);
  assert.equal(run.pinned.length, 1);
  assert.equal(run.pinned[0].heavy, true);
  assert.equal(run.ringPinned, 2);
  assert.ok(types(run.drainEvents()).includes('heavyPin'));
});

test('heavyBonus 升级：重光子占 3 钉进度', () => {
  const run = createRun({ seed: 12 });
  run.mods.heavyBonus = true;
  run.nextHeavy = true;
  fireAndLand(run);
  assert.equal(run.ringPinned, 3);
});

test('每 20 钉下一次是重光子', () => {
  const run = createRun({ seed: 13 });
  run.totalPins = 19;
  run.nextHeavy = ((run.totalPins + 1) % PHOTON.OVERLOAD_EVERY) === 0;
  assert.equal(run.nextHeavy, true);
  fireAndLand(run);
  assert.equal(run.pinned[0].heavy, true);
});

// ---------- 极性反转 ----------
test('极性反转：换向 + 吸入一颗已钉光子', () => {
  const run = createRun({ seed: 14, startRing: 5 });
  const before = run.cores[0].omegaBase;
  run.pinned.push({ id: run.nextId++, coreId: run.cores[0].id, slot: 0, r: PHOTON.R, heavy: false, value: 1 });
  run.polarityEvery = 0.2;
  run.polarityTimer = 0.005;
  run.step({ fire: false });
  assert.notEqual(run.cores[0].omegaBase, before, '极性反转应换向');
  assert.equal(run.pinned.length, 0, '应吸入一颗光子');
  const evs = types(run.drainEvents());
  assert.ok(evs.includes('polarityReversal'));
  assert.ok(evs.includes('photonSuck'));
});

test('polarityResist 升级：只换向不吸光子', () => {
  const run = createRun({ seed: 15, startRing: 5 });
  run.mods.polarityResist = true;
  const before = run.cores[0].omegaBase;
  run.pinned.push({ id: run.nextId++, coreId: run.cores[0].id, slot: 0, r: PHOTON.R, heavy: false, value: 1 });
  run.polarityEvery = 0.2;
  run.polarityTimer = 0.005;
  run.step({ fire: false });
  assert.notEqual(run.cores[0].omegaBase, before);
  assert.equal(run.pinned.length, 1, 'polarityResist 不应吸光子');
});

// ---------- 升级 / 事件密度 ----------
test('applyUpgrade 设置 mod 并重建核心（slowCore 降速）', () => {
  const run = createRun({ seed: 16 });
  const before = run.cores[0].omegaBase;
  assert.equal(run.applyUpgrade('slowCore'), true);
  assert.equal(run.mods.slowCore, true);
  assert.equal(run.cores[0].omegaBase, before * 0.88);
  assert.ok(types(run.drainEvents()).includes('upgradeChosen'));
});

test('pinSpeed 升级：光子飞行更快（更少 tick 钉入）', () => {
  const slow = createRun({ seed: 17 });
  slow.step({ fire: true });
  let slowTicks = 0;
  for (; slow.photon && slow.phase === 'playing'; slowTicks += 1) slow.step({ fire: false });

  const fast = createRun({ seed: 18 });
  fast.mods.pinSpeed = true;
  fast.step({ fire: true });
  let fastTicks = 0;
  for (; fast.photon && fast.phase === 'playing'; fastTicks += 1) fast.step({ fire: false });

  assert.ok(fastTicks < slowTicks, `fast=${fastTicks} should be < slow=${slowTicks}`);
});

test('spin 事件每 tick 一次（无死时间基线）', () => {
  const run = createRun({ seed: 19 });
  stepN(run, 10);
  assert.ok(types(run.drainEvents()).filter((t) => t === 'spin').length === 10);
});

// ---------- 纯函数 ----------
test('slotHalf：半径越大的光子占位越大', () => {
  assert.ok(slotHalf(PHOTON.HEAVY_R, CORE.R) > slotHalf(PHOTON.R, CORE.R));
});

test('angDist / normAngle 归一化正确', () => {
  assert.ok(Math.abs(angDist(0.1, 6.2)) < 0.2);
  assert.equal(normAngle(-0.1), 2 * Math.PI - 0.1);
  assert.equal(normAngle(7), 7 - 2 * Math.PI);
});

test('ringAt 越界回夹到有效环', () => {
  assert.equal(ringAt(0).index, 1);
  assert.equal(ringAt(13).index, 12);
  assert.equal(RING_COUNT, 12);
});
