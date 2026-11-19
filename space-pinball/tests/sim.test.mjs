import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { WORLD } from '../config/game.config.js';
import { REACTOR } from '../config/gameplay.js';

function stepN(run, n, input = {}) {
  for (let i = 0; i < n; i += 1) run.step(input);
}

test('createRun 初始状态符合契约', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.score, 0);
  assert.equal(run.ballsLeft, 3);
  assert.equal(run.balls.length, 1);
  assert.equal(run.balls[0].state, 'ready');
  assert.equal(run.wave, 1);
  assert.deepEqual(run.drainEvents(), []);
});

test('getHud 契约字段齐全', () => {
  const run = createRun({ seed: 2 });
  const hud = run.getHud();
  assert.deepEqual(Object.keys(hud).sort(), [
    'ballsInPlay', 'ballsLeft', 'combo', 'launchCharge', 'phase', 'rating',
    'reactorLights', 'reactorMax', 'score', 'starsLit', 'supernovaT', 'wave',
  ]);
  assert.equal(hud.phase, 'playing');
});

test('同 seed 同输入 → 同结果（确定性）', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  for (let i = 0; i < 240; i += 1) {
    const input = { left: i % 7 === 0, right: i % 11 === 0, launch: i > 20 && i < 80, nudge: 0 };
    a.step(input);
    b.step(input);
  }
  assert.equal(a.score, b.score);
  assert.equal(a.wave, b.wave);
  assert.equal(a.balls[0].x, b.balls[0].x);
  assert.equal(a.balls[0].y, b.balls[0].y);
  assert.deepEqual(a.drainEvents().map((e) => e.type), b.drainEvents().map((e) => e.type));
});

test('推杆：按住蓄力后释放 → 球变 live 且向上', () => {
  const run = createRun({ seed: 3 });
  stepN(run, 30, { launch: true });
  assert.equal(run.balls[0].state, 'ready');
  run.step({ launch: false });
  const b = run.balls[0];
  assert.equal(b.state, 'live');
  assert.ok(b.vy < 0, '向上发射');
  assert.ok(run.drainEvents().some((e) => e.type === 'launch'));
});

test('挡板：按住左键 → 左挡板翻起并发 flipper 事件', () => {
  const run = createRun({ seed: 4 });
  const f = run.flippers.find((x) => x.id === 'left');
  const rest = f.angle;
  run.step({ left: true });
  assert.ok(run.drainEvents().some((e) => e.type === 'flipper' && e.id === 'left'));
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
  b.y = bp.y - 6;
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

test('反应堆：命中 → 点灯 + 加速', () => {
  const run = createRun({ seed: 10 });
  const b = run.balls[0];
  b.state = 'live';
  const rc = run.table.reactor;
  b.x = rc.x;
  b.y = rc.y + rc.r + b.r - 6;
  b.vx = 0;
  b.vy = -300;
  const beforeV = Math.hypot(b.vx, b.vy);
  run.step({});
  assert.ok(run.reactorLights > 0, '反应堆灯 +1');
  assert.ok(run.stats.reactorHits > 0, '反应堆命中计数');
  assert.ok(Math.hypot(b.vx, b.vy) !== beforeV, '球速改变');
  assert.ok(run.drainEvents().some((e) => e.type === 'reactorHit'));
});

test('反应堆超载：集满灯 → wave+1 + 灯重置', () => {
  const run = createRun({ seed: 11 });
  run.reactorLights = REACTOR.LIGHTS - 1;
  const b = run.balls[0];
  b.state = 'live';
  const rc = run.table.reactor;
  b.x = rc.x;
  b.y = rc.y + rc.r + b.r - 6;
  b.vx = 0;
  b.vy = -300;
  run.step({});
  assert.equal(run.wave, 2);
  assert.equal(run.reactorLights, 0);
  assert.ok(run.drainEvents().some((e) => e.type === 'reactorOverdrive'));
});

test('按钮组：全按下 → 大奖 + 反应堆灯 +1', () => {
  const run = createRun({ seed: 12 });
  const b = run.balls[0];
  b.state = 'live';
  run.buttons.forEach((btn) => { btn.pressed = true; });
  run.buttons[0].pressed = false;
  b.x = run.buttons[0].x;
  b.y = run.buttons[0].y + 40;
  b.vx = 0;
  b.vy = -800;
  const lights = run.reactorLights;
  const evs = [];
  for (let i = 0; i < 12; i += 1) { run.step({}); evs.push(...run.drainEvents()); }
  assert.ok(evs.some((e) => e.type === 'buttonGroupComplete'));
  assert.equal(run.reactorLights, lights + 1);
  assert.ok(run.buttons.every((x) => !x.pressed), '按钮复位');
});

test('通道组：全翻转 → 大奖 + 复位', () => {
  const run = createRun({ seed: 13 });
  const b = run.balls[0];
  b.state = 'live';
  run.gates.forEach((g) => { g.active = true; });
  run.gates[0].active = false;
  b.x = run.gates[0].x;
  b.y = run.gates[0].y + 40;
  b.vx = 0;
  b.vy = -800;
  const evs = [];
  for (let i = 0; i < 12; i += 1) { run.step({}); evs.push(...run.drainEvents()); }
  assert.ok(evs.some((e) => e.type === 'gateGroupComplete'));
  assert.ok(run.gates.every((x) => !x.active), '通道复位');
});

test('升级垫：全激活 → shardLevel+1', () => {
  const run = createRun({ seed: 14 });
  const b = run.balls[0];
  b.state = 'live';
  run.upgradePads.forEach((up) => { up.active = true; });
  run.upgradePads[0].active = false;
  b.x = run.upgradePads[0].x;
  b.y = run.upgradePads[0].y + 40;
  b.vx = 0;
  b.vy = -800;
  const evs = [];
  for (let i = 0; i < 12; i += 1) { run.step({}); evs.push(...run.drainEvents()); }
  assert.equal(run.shardLevel, 1);
  assert.ok(evs.some((e) => e.type === 'shardLevelUp'));
});

test('小行星：3 次命中 → 摧毁', () => {
  const run = createRun({ seed: 15 });
  const b = run.balls[0];
  b.state = 'live';
  const a = run.asteroids[0];
  for (let i = 0; i < 3; i += 1) {
    a.hp = 3 - i;
    a.lastHit = -Infinity;
    b.x = a.x;
    b.y = a.y + a.r + b.r - 4;
    b.vx = 0;
    b.vy = -200;
    run.step({});
    run.drainEvents();
    if (a.dead) break;
  }
  assert.equal(a.dead, true, '小行星被摧毁');
});

test('星核：集齐 3 颗 → 超新星态', () => {
  const run = createRun({ seed: 16 });
  const b = run.balls[0];
  b.state = 'live';
  run.stars.forEach((st) => { st.lit = true; });
  run.stars[0].lit = false;
  b.x = run.stars[0].x;
  b.y = run.stars[0].y;
  b.vx = 0;
  b.vy = 0;
  run.step({});
  assert.ok(run.supernovaT > 0, '超新星态启动');
  assert.ok(run.drainEvents().some((e) => e.type === 'supernova'));
});

test('连击：窗口内连续命中 combo 递增，超时 comboBreak 重置', () => {
  const run = createRun({ seed: 17 });
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
  b.x = 320;
  b.y = 400;
  run.time += 3;
  run.step({});
  assert.equal(run.combo, 0);
  assert.ok(run.drainEvents().some((e) => e.type === 'comboBreak'));
});

test('黑洞：吸入 → 延迟喷出', () => {
  const run = createRun({ seed: 18 });
  const bh = run.table.blackHoles[0];
  const b = run.balls[0];
  b.state = 'live';
  b.x = bh.x;
  b.y = bh.y;
  b.vx = 0;
  b.vy = 0;
  run.step({});
  assert.ok(run.drainEvents().some((e) => e.type === 'blackHole'));
  run.time += 0.9;
  run.step({});
  assert.ok(run.balls.some((x) => x.state === 'live'), '球被喷回');
  assert.ok(run.drainEvents().some((e) => e.type === 'blackHoleEject'));
});

test('虫洞：进入入口 → 传送到出口', () => {
  const run = createRun({ seed: 19 });
  const b = run.balls[0];
  b.state = 'live';
  const pin = run.table.portal.in;
  b.x = pin.x;
  b.y = pin.y;
  b.vx = 0;
  b.vy = 0;
  run.step({});
  const out = run.table.portal.out;
  assert.ok(Math.abs(b.x - out.x) < 1 && Math.abs(b.y - out.y) < 1, '传送到出口');
  assert.ok(run.drainEvents().some((e) => e.type === 'portal'));
});
