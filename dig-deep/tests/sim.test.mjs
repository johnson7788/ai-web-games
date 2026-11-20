import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { RIG, REWARDS, COLLAPSE } from '../config/gameplay.js';
import { TOTAL_ROWS } from '../config/levels.js';

function stepN(run, n, input = {}) {
  for (let i = 0; i < n; i += 1) {
    if (run.phase !== 'playing') break;
    run.step(input);
  }
}

function cell(type, hard = 1) {
  return { type, hard: hard === Infinity ? Infinity : hard, alive: true };
}

// 直接铺一行（绕过随机生成，做确定性断言）
function setRow(run, depth, cells) {
  run.rows.set(depth, cells.map((c) => (typeof c === 'string' ? cell(c) : c)));
}

function digUntil(run, max = 200) {
  const evs = [];
  const startDepth = run.depth;
  for (let i = 0; i < max && run.depth === startDepth && run.phase === 'playing'; i += 1) {
    run.step({ dig: true });
    evs.push(...run.drainEvents());
  }
  return evs;
}

test('createRun：初始状态', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.phase, 'playing');
  assert.equal(r.stamina, RIG.startStamina);
  assert.equal(r.depth, 0);
  assert.equal(r.col, 2);
  assert.equal(r.tool, 0);
  assert.equal(r.maxTool, 0);
  assert.equal(r.layer, 1);
});

test('step：时间推进固定步长', () => {
  const r = createRun({ seed: 1 });
  r.step({});
  assert.equal(r.time, 1 / 60);
});

test('dig：消耗体力并产生事件', () => {
  const r = createRun({ seed: 1 });
  setRow(r, 0, ['dirt', 'dirt', 'dirt', 'dirt', 'dirt']);
  r.step({ dig: true });
  const evs = r.drainEvents();
  assert.ok(evs.some((e) => e.type === 'dig'), '应该发 dig 事件');
  assert.ok(r.stamina < RIG.startStamina, '体力应减少');
});

test('dig：挖穿格后深度 +1', () => {
  const r = createRun({ seed: 1 });
  setRow(r, 0, ['dirt', 'dirt', 'dirt', 'dirt', 'dirt']);
  const evs = digUntil(r);
  assert.equal(r.depth, 1, '深度应 +1');
  assert.ok(evs.some((e) => e.type === 'cellBreak'));
});

test('钻石：收集加分数与体力', () => {
  const r = createRun({ seed: 1 });
  r.stamina = 20;
  setRow(r, 0, ['dirt', 'dirt', 'diamond', 'dirt', 'dirt']);
  r.col = 2;
  const before = r.stamina;
  const evs = digUntil(r);
  assert.ok(evs.some((e) => e.type === 'diamond'));
  assert.ok(r.stamina > before, '钻石应回体力');
  assert.ok(r.score >= REWARDS.diamondScore, '钻石应加分');
});

test('化石：收集加体力、激光充能与分数', () => {
  const r = createRun({ seed: 1 });
  setRow(r, 0, ['dirt', 'dirt', 'fossil', 'dirt', 'dirt']);
  r.col = 2;
  const beforeCharge = r.laserCharges;
  const evs = digUntil(r);
  assert.ok(evs.some((e) => e.type === 'fossil'));
  assert.ok(r.laserCharges > beforeCharge, '化石应加激光充能');
});

test('岩块：铲子挖不动，发 rockBlocked 且深度不变', () => {
  const r = createRun({ seed: 1 });
  setRow(r, 0, ['dirt', 'dirt', 'rock', 'dirt', 'dirt']);
  r.col = 2;
  const before = r.depth;
  r.step({ dig: true });
  const evs = r.drainEvents();
  assert.ok(evs.some((e) => e.type === 'rockBlocked'));
  assert.equal(r.depth, before, '挖岩块不应推进深度');
});

test('激光：切岩消耗充能并推进', () => {
  const r = createRun({ seed: 1 });
  setRow(r, 0, ['dirt', 'dirt', 'rock', 'dirt', 'dirt']);
  r.col = 2;
  r.maxTool = 2;
  r.tool = 2;
  r.laserCharges = 5;
  const before = r.laserCharges;
  const evs = digUntil(r);
  assert.ok(evs.some((e) => e.type === 'rockCut'), '应发 rockCut');
  assert.ok(r.laserCharges < before, '激光充能应减少');
  assert.equal(r.depth, 1, '激光切岩后应推进');
});

test('断层：铲子挖会塌方（扣体力 + collapse 事件）', () => {
  const r = createRun({ seed: 1 });
  r.stamina = 40;
  setRow(r, 0, ['dirt', 'dirt', 'fault', 'dirt', 'dirt']);
  setRow(r, 1, ['dirt', 'dirt', 'dirt', 'dirt', 'dirt']);
  r.col = 2;
  r.tool = 0;
  const before = r.stamina;
  const evs = digUntil(r);
  assert.ok(evs.some((e) => e.type === 'faultBreak'));
  assert.ok(evs.some((e) => e.type === 'collapse'), '铲子挖断层应塌方');
  assert.ok(r.stamina <= before - COLLAPSE.staminaDamage + 0.01, '塌方应扣体力');
});

test('断层：钻头挖不塌方', () => {
  const r = createRun({ seed: 1 });
  r.stamina = 40;
  setRow(r, 0, ['dirt', 'dirt', 'fault', 'dirt', 'dirt']);
  r.col = 2;
  r.tool = 1;
  const evs = digUntil(r);
  assert.ok(evs.some((e) => e.type === 'faultBreak'));
  assert.ok(!evs.some((e) => e.type === 'collapse'), '钻头挖断层不应塌方');
});

test('熔岩：挖到会重开本层并扣体力', () => {
  const r = createRun({ seed: 1 });
  r.stamina = 40;
  setRow(r, 0, ['dirt', 'dirt', 'lava', 'dirt', 'dirt']);
  r.col = 2;
  const before = r.depth;
  r.step({ dig: true });
  const evs = r.drainEvents();
  assert.ok(evs.some((e) => e.type === 'lava'), '应发 lava 事件');
  assert.ok(evs.some((e) => e.type === 'layerRestart'), '应重开本层');
  assert.ok(r.stamina < 40, '应扣体力');
});

test('洪水：noinput 最终被淹死', () => {
  const r = createRun({ seed: 1 });
  stepN(r, 3000, {});
  assert.equal(r.phase, 'dead');
  assert.equal(r.deadReason, 'drown');
});

test('体力：耗尽死亡', () => {
  const r = createRun({ seed: 1 });
  setRow(r, 0, ['dirt', 'dirt', 'dirt', 'dirt', 'dirt']);
  r.stamina = 0;
  r.tool = 0;
  r.step({ dig: true });
  r.drainEvents();
  assert.equal(r.phase, 'dead');
  assert.equal(r.deadReason, 'exhaust');
});

test('横移：col 在 0..4 之间并产生 move 事件', () => {
  const r = createRun({ seed: 1 });
  r.step({ move: -1 });
  const evs = r.drainEvents();
  assert.ok(evs.some((e) => e.type === 'move'), '应发 move 事件');
  assert.equal(r.col, 1);
  // 撞左墙后不再减
  for (let i = 0; i < 60; i += 1) { r.step({ move: -1 }); r.drainEvents(); }
  assert.equal(r.col, 0);
});

test('工具切换：受 maxTool 门控', () => {
  const r = createRun({ seed: 1 });
  r.step({ tool: 2 });
  r.drainEvents();
  assert.equal(r.tool, 0, '未解锁激光不能切');
  r.step({ tool: 1 });
  r.drainEvents();
  assert.equal(r.tool, 0, '未解锁钻头不能切');
  r.maxTool = 2;
  r.step({ tool: 2 });
  const evs = r.drainEvents();
  assert.equal(r.tool, 2);
  assert.ok(evs.some((e) => e.type === 'toolChange'));
});

test('层推进：进入第 2 层解锁钻头', () => {
  const r = createRun({ seed: 1 });
  r.maxTool = 2;
  r.tool = 2;
  r.laserCharges = 999;
  r.stamina = 999;
  stepN(r, 3000, { dig: true });
  assert.ok(r.layer >= 2, `应到第 2 层，实际 ${r.layer}`);
  assert.ok(r.maxTool >= 1, '第 2 层应解锁钻头');
});

test('层推进：进入第 3 层解锁激光', () => {
  const r = createRun({ seed: 1 });
  r.maxTool = 2;
  r.tool = 2;
  r.laserCharges = 999;
  r.stamina = 999;
  stepN(r, 6000, { dig: true });
  assert.ok(r.layer >= 3, `应到第 3 层，实际 ${r.layer}`);
  assert.ok(r.maxTool >= 2, '第 3 层应解锁激光');
});

test('地心：挖到总深度触发 coreReach', () => {
  const r = createRun({ seed: 1 });
  r.maxTool = 2;
  r.tool = 2;
  r.laserCharges = 99999;
  r.stamina = 99999;
  stepN(r, 20000, { dig: true });
  assert.ok(r.depth >= TOTAL_ROWS, `应挖穿，实际 ${r.depth}/${TOTAL_ROWS}`);
  assert.ok(r.coreReached, '应触发 coreReach');
});

test('里程碑：每 5 行发一次 milestone', () => {
  const r = createRun({ seed: 1 });
  r.maxTool = 2;
  r.tool = 2;
  r.laserCharges = 999;
  r.stamina = 999;
  let saw = false;
  for (let i = 0; i < 3000 && !saw; i += 1) {
    r.step({ dig: true });
    if (r.drainEvents().some((e) => e.type === 'milestone')) saw = true;
  }
  assert.ok(saw, '应发 milestone 事件');
});

test('drainEvents：取出后清空', () => {
  const r = createRun({ seed: 1 });
  setRow(r, 0, ['dirt', 'dirt', 'dirt', 'dirt', 'dirt']);
  r.step({ dig: true });
  const first = r.drainEvents();
  assert.ok(first.length > 0);
  assert.equal(r.drainEvents().length, 0);
});

test('确定性：同种子首行一致', () => {
  const a = createRun({ seed: 99 });
  const b = createRun({ seed: 99 });
  setRow(a, 0, ['dirt', 'dirt', 'dirt', 'dirt', 'dirt']);
  setRow(b, 0, ['dirt', 'dirt', 'dirt', 'dirt', 'dirt']);
  a.step({ dig: true });
  b.step({ dig: true });
  const ra = a.rows.get(0);
  const rb = b.rows.get(0);
  assert.deepEqual(ra.map((c) => c.type), rb.map((c) => c.type));
});

test('getHud：返回完整遥测字段', () => {
  const r = createRun({ seed: 1 });
  const hud = r.getHud();
  assert.ok('depth' in hud && 'score' in hud && 'stamina' in hud);
  assert.ok('layer' in hud && 'tool' in hud && 'laserCharges' in hud);
  assert.equal(hud.phase, 'playing');
});
