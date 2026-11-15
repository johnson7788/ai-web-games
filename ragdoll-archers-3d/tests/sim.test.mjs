// tests/sim.test.mjs — 纯逻辑测试：数值 / 状态机 / 边界 / seed 回归。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, updateSim, drainEvents, getHud,
  solveAim, solveVelocity, getUpgradeChoices, applyUpgrade,
} from '../src/game/sim.js';
import { PLAYER, QUIVER, WORLD, ARROW, LEVELS, UPGRADES } from '../config/game.config.js';

// 贪心助手：自动瞄准躯干，拉满弓放箭，横移到目标 z；可选让对手永不命中（测通关）
function runGreedy(run, { harmless = false, maxSec = 90 } = {}) {
  let cool = 0, shots = 0;
  const step = () => {
    let inp = { strafe: 0, aim: null, fire: false };
    if (run.phase === 'duel') {
      if (harmless) run.enemies.forEach((e) => { e.accuracy = 0; });
      cool -= 1 / 60;
      const tgt = run.enemies.find((e) => e.alive);
      const dz = tgt ? tgt.z - run.player.z : 0;
      if (tgt && Math.abs(dz) > 0.25) inp.strafe = Math.sign(dz);
      else if (tgt && cool <= 0 && run.quiver > 0) {
        const aim = solveAim(run, 'torso');
        inp.aim = aim;
        inp.fire = run.player.aimPower >= aim.power * 0.995;
        if (inp.fire) { shots++; cool = 0.8; }
      }
    }
    updateSim(run, inp);
    drainEvents(run);
    if (run.phase === 'upgrade') applyUpgrade(run, getUpgradeChoices(run, 3)[0]);
    return run.phase;
  };
  let t = 0;
  while (t < maxSec * 60) {
    const p = step();
    if (p === 'won' || p === 'dead') break;
    t++;
  }
  return { shots };
}

test('初始状态：3 心 / 5 箭 / 第 1 关 / duel', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.hearts, PLAYER.hearts);
  assert.equal(r.quiver, QUIVER.max);
  assert.equal(r.level, 1);
  assert.equal(r.phase, 'duel');
  assert.equal(r.enemies.length, 1);
});

test('射箭：拉满弓放箭后箭袋减 1 且生成玩家箭', () => {
  const r = createRun({ seed: 1 });
  const aim = solveAim(r, 'torso');
  // 拉弓到满功率
  for (let i = 0; i < 200 && r.player.aimPower < aim.power * 0.99; i++) updateSim(r, { aim });
  const before = r.quiver;
  updateSim(r, { aim, fire: true });
  assert.equal(r.quiver, before - 1);
  assert.ok(r.arrows.some((a) => a.owner === 'player'));
});

test('空箭袋：开火不生成箭', () => {
  const r = createRun({ seed: 1 });
  r.quiver = 0;
  const aim = solveAim(r, 'torso');
  for (let i = 0; i < 200; i++) updateSim(r, { aim });
  updateSim(r, { aim, fire: true });
  assert.equal(r.arrows.filter((a) => a.owner === 'player').length, 0);
});

test('箭袋补给：约 4 秒回 1 支', () => {
  const r = createRun({ seed: 1 });
  r.enemies.forEach((e) => { e.accuracy = 0; });
  r.quiver = 0;
  for (let i = 0; i < 60 * QUIVER.regenSec + 5; i++) updateSim(r, {});
  assert.equal(r.quiver, 1);
});

test('solveVelocity：可达目标返回初速，不可达返回 null', () => {
  const v = solveVelocity({ x: 0, y: 1.2, z: 0 }, { x: 12, y: 1.1, z: 0 }, 0, ARROW.maxSpeed);
  assert.ok(v);
  assert.ok(Math.hypot(v.vx, v.vy, v.vz) <= ARROW.maxSpeed + 1e-6);
  assert.equal(solveVelocity({ x: 0, y: 1.2, z: 0 }, { x: 200, y: 5, z: 0 }, 0, ARROW.maxSpeed), null);
});

test('solveAim：返回角度/力度在合法范围内', () => {
  const r = createRun({ seed: 1 });
  const a = solveAim(r, 'torso');
  assert.ok(a.angle >= ARROW.minAngle && a.angle <= ARROW.maxAngle);
  assert.ok(a.power >= 0 && a.power <= 1);
});

test('横移：被夹在竞技场 z 边界内', () => {
  const r = createRun({ seed: 1 });
  for (let i = 0; i < 60 * 5; i++) updateSim(r, { strafe: 1 });
  assert.ok(r.player.z <= WORLD.ARENA_Z + 1e-6);
  for (let i = 0; i < 60 * 10; i++) updateSim(r, { strafe: -1 });
  assert.ok(r.player.z >= -WORLD.ARENA_Z - 1e-6);
});

test('风影响抛物线预览（风越大偏移越大）', () => {
  const r = createRun({ seed: 1 });
  const aim = { angle: 0.5, power: 0.8 };
  r.wind.strength = 0;
  updateSim(r, { aim });
  const x0 = r.trajectory[r.trajectory.length - 1].x;
  r.wind.strength = 4;
  updateSim(r, { aim });
  const x1 = r.trajectory[r.trajectory.length - 1].x;
  assert.ok(Math.abs(x1 - x0) > 0.5, `风应明显偏移预览（${x0} → ${x1}）`);
});

test('躯干两箭击杀：第二箭触发 levelClear', () => {
  const r = createRun({ seed: 1 });
  runGreedy(r, { harmless: true, maxSec: 20 });
  assert.ok(r.phase === 'levelClear' || r.phase === 'upgrade' || r.level > 1, '击杀第 1 关后应进入关卡结算');
  assert.ok(r.phase !== 'dead');
});

test('升级：三选一返回 3 个不同 id，应用后进下一关', () => {
  const r = createRun({ seed: 1 });
  const choices = getUpgradeChoices(r, 3);
  assert.equal(choices.length, 3);
  assert.equal(new Set(choices).size, 3);
  assert.ok(choices.every((id) => UPGRADES.some((u) => u.id === id)));
  const ok = applyUpgrade(r, choices[0]);
  assert.equal(ok, true);
  assert.equal(r.level, 2);
  assert.equal(r.phase, 'duel');
  assert.ok(r.upgrades.has(choices[0]));
});

test('通关：对手永不命中时能清完 5 关到 won', () => {
  const r = createRun({ seed: 7 });
  runGreedy(r, { harmless: true, maxSec: 90 });
  assert.equal(r.phase, 'won');
  assert.equal(r.level, LEVELS.length);
});

test('爆头：瞄准头一击必杀且 headshots 计数', () => {
  const r = createRun({ seed: 1 });
  r.enemies.forEach((e) => { e.accuracy = 0; });
  let fired = false;
  for (let i = 0; i < 60 * 15 && !fired; i++) {
    const aim = solveAim(r, 'head');
    updateSim(r, { aim });
    if (r.player.aimPower >= aim.power * 0.99) { updateSim(r, { aim, fire: true }); fired = true; }
    drainEvents(r);
  }
  // 步进让箭命中
  for (let i = 0; i < 60 * 3; i++) { updateSim(r, {}); drainEvents(r); if (r.phase === 'levelClear') break; }
  assert.equal(r.headshots, 1);
  assert.ok(r.phase === 'levelClear' || r.phase === 'upgrade');
});

test('玩家被击倒：扣 1 心并重开本关', () => {
  const r = createRun({ seed: 1 });
  r.enemies.forEach((e) => { e.accuracy = 1; });
  // 静止挨打直到掉血
  for (let i = 0; i < 60 * 20 && r.hearts === PLAYER.hearts; i++) { updateSim(r, {}); drainEvents(r); }
  assert.ok(r.hearts < PLAYER.hearts, '静止应被击倒');
  assert.equal(r.level, 1, '被击倒应重开本关');
});

test('三心耗尽：进入 dead 状态', () => {
  const r = createRun({ seed: 1 });
  r.enemies.forEach((e) => { e.accuracy = 1; });
  for (let i = 0; i < 60 * 60 && r.phase !== 'dead'; i++) { updateSim(r, {}); drainEvents(r); }
  assert.equal(r.phase, 'dead');
});

test('seed 回归：同 seed 事件序列一致', () => {
  const evs = (seed) => {
    const r = createRun({ seed });
    const out = [];
    for (let i = 0; i < 60 * 5; i++) { updateSim(r, {}); out.push(...drainEvents(r).map((e) => e.type)); }
    return out.slice(0, 12);
  };
  assert.deepEqual(evs(42), evs(42));
  assert.notDeepEqual(evs(42), evs(43));
});

test('drainEvents：取走后清空', () => {
  const r = createRun({ seed: 1 });
  updateSim(r, {});
  const evs = drainEvents(r);
  assert.ok(evs.length >= 0);
  assert.equal(r.events.length, 0);
});

test('对手 AI：静止无输入也会触发 enemy_shot', () => {
  const r = createRun({ seed: 1 });
  let saw = false;
  for (let i = 0; i < 60 * 10 && !saw; i++) { updateSim(r, {}); if (drainEvents(r).some((e) => e.type === 'enemy_shot')) saw = true; }
  assert.equal(saw, true);
});

test('第 5 关双对手：敌人数量为 2', () => {
  const r = createRun({ seed: 1 });
  const harmless = true;
  // 一路打到第 5 关
  runGreedy(r, { harmless: true, maxSec: 60 });
  if (r.level === 5) assert.equal(r.enemies.length, 2);
  else assert.ok(r.phase === 'won', '应已通关');
});

test('getHud：返回核心字段', () => {
  const r = createRun({ seed: 1 });
  const h = getHud(r);
  for (const k of ['phase', 'level', 'hearts', 'quiver', 'time', 'headshots']) assert.ok(k in h);
});
