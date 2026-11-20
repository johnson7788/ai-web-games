import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { WORLD } from '../config/game.config.js';
import { LAUNCH } from '../config/gameplay.js';

function stepN(run, n, input = {}) {
  for (let i = 0; i < n; i += 1) run.step(input);
}

function types(events) {
  return events.map((e) => e.type);
}

test('createRun 初始状态符合契约', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.machine, 1);
  assert.equal(run.score, 0);
  assert.equal(run.ballsLeft, 3);
  assert.equal(run.balls.length, 1);
  assert.equal(run.balls[0].state, 'ready');
  assert.equal(run.getHud().machine, 1);
  assert.deepEqual(run.drainEvents(), []);
});

test('getHud 契约字段齐全', () => {
  const run = createRun({ seed: 2 });
  const hud = run.getHud();
  assert.deepEqual(Object.keys(hud).sort(), [
    'ballsInPlay', 'ballsLeft', 'combo', 'launchCharge', 'machine', 'multiplier',
    'phase', 'scene', 'score', 'superconductLights', 'superconductT', 'targetScore',
  ]);
  assert.equal(hud.phase, 'playing');
});

test('同 seed 同输入 → 同结果（随机种子确定性）', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  for (let i = 0; i < 240; i += 1) {
    const input = { left: i % 7 === 0, right: i % 11 === 0, launch: i > 20 && i < 80, nudge: 0 };
    a.step(input);
    b.step(input);
  }
  assert.equal(a.score, b.score);
  assert.equal(a.machine, b.machine);
  assert.equal(a.balls[0].x, b.balls[0].x);
  assert.equal(a.balls[0].y, b.balls[0].y);
  assert.deepEqual(a.drainEvents().map((e) => e.type), b.drainEvents().map((e) => e.type));
});

test('推杆：按住蓄力后释放 → 球变 live 且速度左上', () => {
  const run = createRun({ seed: 3 });
  stepN(run, 30, { launch: true }); // 蓄力 0.5s
  assert.equal(run.balls[0].state, 'ready');
  run.step({ launch: false });      // 释放
  const b = run.balls[0];
  assert.equal(b.state, 'live');
  assert.ok(b.vy < 0, '向上发射');
  assert.ok(b.vx < 0, '向左上发射');
  assert.ok(run.drainEvents().some((e) => e.type === 'launch'));
});

test('挡板：按住左键 → 左挡板翻起并发 flipper 事件', () => {
  const run = createRun({ seed: 4 });
  const f = run.flippers.find((x) => x.id === 'left');
  const rest = f.angle;
  run.step({ left: true });
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'flipper' && e.id === 'left'));
  stepN(run, 30, { left: true });
  assert.notEqual(f.angle, rest, '挡板角度应变化');
});

test('挡板：右键只翻右挡板', () => {
  const run = createRun({ seed: 5 });
  const lf = run.flippers.find((x) => x.id === 'left');
  const rf = run.flippers.find((x) => x.id === 'right');
  const la = lf.angle;
  const ra = rf.angle;
  stepN(run, 30, { right: true });
  assert.equal(lf.angle, la, '左挡板不动');
  assert.notEqual(rf.angle, ra, '右挡板翻起');
});

test('bumper 命中：得分 + 发 bumperHit + 连击上涨', () => {
  const run = createRun({ seed: 6 });
  const b = run.balls[0];
  b.state = 'live';
  const bp = run.table.bumpers[0];
  b.x = bp.x;
  b.y = bp.y - 6; // 与 bumper 重叠 36px
  b.vx = 0;
  b.vy = 0;
  const before = run.score;
  run.step({});
  assert.ok(run.score > before, '得分增加');
  assert.ok(run.drainEvents().some((e) => e.type === 'bumperHit'));
  assert.ok(run.combo >= 1);
});

test('空气阻尼：无碰撞时水平速度随时间衰减', () => {
  const run = createRun({ seed: 7 });
  const b = run.balls[0];
  b.state = 'live';
  b.x = 600;
  b.y = 300;
  b.vx = 800;
  b.vy = 0;
  stepN(run, 3, {});
  assert.ok(b.vx < 800, `空气阻尼后 vx=${b.vx} 应 < 800`);
});

test('掉球判负：球越过 DRAIN_Y → ballLost 且 ballsLeft -1', () => {
  const run = createRun({ seed: 8 });
  const b = run.balls[0];
  b.state = 'live';
  b.x = 640;
  b.y = WORLD.DRAIN_Y + 5;
  run.step({});
  assert.equal(run.ballsLeft, 2);
  assert.ok(run.drainEvents().some((e) => e.type === 'ballLost'));
  assert.equal(run.balls[0].state, 'ready', '补一颗待发球');
});

test('game over：连掉 3 球 → phase=dead + gameOver 事件', () => {
  const run = createRun({ seed: 9 });
  for (let k = 0; k < 3; k += 1) {
    const b = run.balls.find((x) => x.state === 'ready');
    b.state = 'live';
    b.y = WORLD.DRAIN_Y + 5;
    run.step({});
  }
  assert.equal(run.phase, 'dead');
  assert.ok(run.drainEvents().some((e) => e.type === 'gameOver'));
});

test('超导：点亮 3 个超导灯 → 超导态 20s', () => {
  const run = createRun({ seed: 10 });
  const b = run.balls[0];
  b.state = 'live';
  for (let i = 0; i < 3; i += 1) {
    const sc = run.superconducts[i];
    b.x = sc.x;
    b.y = sc.y - 20;
    b.vx = 0;
    b.vy = -100;
    run.step({});
  }
  assert.ok(run.superconductT > 0, '超导态启动');
  assert.ok(run.drainEvents().some((e) => e.type === 'superconduct'));
});

test('超导结束：倒计时归零 → 灯重置', () => {
  const run = createRun({ seed: 11 });
  run.superconductT = 0.01;
  run.superconducts.forEach((s) => { s.lit = true; });
  run.step({});
  assert.equal(run.superconductT, 0);
  assert.ok(run.superconducts.every((s) => !s.lit));
  assert.ok(run.drainEvents().some((e) => e.type === 'superconductEnd'));
});

test('目标灯全亮 → 倍率 +1 且目标重置', () => {
  const run = createRun({ seed: 12 });
  const b = run.balls[0];
  b.state = 'live';
  const m0 = run.multiplier;
  run.targets.forEach((t) => { t.lit = true; });
  // 再撞一个目标触发全亮判定
  const t = run.targets[0];
  t.lit = false;
  b.x = t.x;
  b.y = t.y - 20;
  b.vx = 0;
  b.vy = -100;
  run.step({});
  assert.equal(run.multiplier, m0 + 1);
  assert.ok(run.targets.every((x) => !x.lit));
  assert.ok(run.drainEvents().some((e) => e.type === 'targetsComplete'));
});

test('连击：窗口内连续命中 combo 递增，超时 comboBreak 重置', () => {
  const run = createRun({ seed: 13 });
  const b = run.balls[0];
  b.state = 'live';
  const bp = run.table.bumpers[0];
  for (let i = 0; i < 3; i += 1) {
    b.x = bp.x;
    b.y = bp.y - 6;
    b.vx = 0;
    b.vy = 0;
    run.step({});
  }
  assert.ok(run.combo >= 3, `combo=${run.combo}`);
  b.x = 600; // 移开，避免末步再次撞 bumper
  b.y = 300;
  run.time += 3;
  run.step({});
  assert.equal(run.combo, 0);
  assert.ok(run.drainEvents().some((e) => e.type === 'comboBreak'));
});

test('过关：score 达标 → machine+1 + machineClear', () => {
  const run = createRun({ seed: 14 });
  run.score = run.table.targetScore;
  run.step({});
  assert.equal(run.machine, 2);
  assert.ok(run.drainEvents().some((e) => e.type === 'machineClear'));
  assert.equal(run.balls[0].state, 'ready');
});

test('黑洞：开合时吸入 → 5s 后从喷射口射回', () => {
  const run = createRun({ seed: 15, startMachine: 3 });
  const bh = run.blackHoles[0];
  bh.open = true;
  const b = run.balls[0];
  b.state = 'live';
  b.x = bh.x;
  b.y = bh.y;
  b.vx = 0;
  b.vy = 0;
  run.step({});
  assert.ok(run.drainEvents().some((e) => e.type === 'blackHole'));
  // 前进 5s，球应被射回
  run.time += 5;
  run.step({});
  assert.ok(run.balls.some((x) => x.state === 'live'), '球被射回');
  assert.ok(run.drainEvents().some((e) => e.type === 'blackHoleEject'));
});

test('移动目标：移动目标 x 随时间变化', () => {
  const run = createRun({ seed: 16, startMachine: 8 });
  const t = run.targets.find((x) => x.moving);
  assert.ok(t, 'machine 8 有移动目标');
  const x0 = t.x;
  stepN(run, 30, {});
  assert.notEqual(t.x, x0, '移动目标应移动');
});

test('顶环：充能球命中顶环点亮超导灯', () => {
  const run = createRun({ seed: 17 });
  const b = run.balls[0];
  b.state = 'live';
  b.charged = true;
  const ring = run.table.topRing;
  b.x = ring.x;
  b.y = ring.y - ring.r - b.r + 6;
  b.vx = 0;
  b.vy = -300;
  run.step({});
  assert.ok(run.superconducts.some((s) => s.lit), '顶环充能点亮超导灯');
  assert.ok(run.drainEvents().some((e) => e.type === 'superconductLight'));
});

test('双球台：machine 7 开局补双球', () => {
  const run = createRun({ seed: 18, startMachine: 7 });
  assert.equal(run.table.doubleBall, true);
  assert.equal(run.balls.length, 1, '仍从一颗待发球开始');
});
