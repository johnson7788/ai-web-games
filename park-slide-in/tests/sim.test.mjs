import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, carPolygon } from '../src/game/sim.js';
import { CAR } from '../config/game.config.js';
import { autopilotControl } from '../src/game/autopilot.js';

function drainTypes(run) {
  const types = new Set();
  for (const e of run.drainEvents()) types.add(e.type);
  return types;
}

test('初始状态：第一关，playing，车位尺寸合法', () => {
  const run = createRun(0);
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.level, 1);
  assert.ok(run.state.bay.w > CAR.LENGTH, '车位应比车长');
  assert.ok(run.state.bay.h > CAR.WIDTH, '车位应比车宽');
});

test('油门前进：速度随时间增加', () => {
  const run = createRun(0);
  run.setInput({ throttle: 1 });
  for (let i = 0; i < 30; i += 1) run.step(1 / 60);
  assert.ok(run.state.car.speed > 0, '速度应为正');
});

test('倒车油门：速度为负', () => {
  const run = createRun(0);
  run.setInput({ throttle: -1 });
  for (let i = 0; i < 30; i += 1) run.step(1 / 60);
  assert.ok(run.state.car.speed < 0, '速度应为负');
});

test('松油门：滑行事件 + 速度衰减', () => {
  const run = createRun(0);
  run.setInput({ throttle: 1 });
  for (let i = 0; i < 30; i += 1) run.step(1 / 60);
  run.setInput({ throttle: 0 });
  assert.ok(drainTypes(run).has('slide'), '应发出 slide 事件');
  const before = run.state.car.speed;
  for (let i = 0; i < 30; i += 1) run.step(1 / 60);
  assert.ok(run.state.car.speed < before, '松油后速度应衰减');
});

test('转向：右转使转向角为正并封顶 30°', () => {
  const run = createRun(0);
  run.setInput({ steerDir: 1 });
  for (let i = 0; i < 120; i += 1) run.step(1 / 60);
  assert.ok(run.state.car.steer > 0, '转向角应为正');
  assert.ok(run.state.car.steer <= CAR.MAX_STEER + 1e-6, '不应超过最大转向角');
});

test('车体多边形：8 个点，随朝向旋转', () => {
  const run = createRun(0);
  const p0 = carPolygon(run.state.car);
  assert.equal(p0.length, 8);
  run.state.car.heading = Math.PI / 2;
  const p90 = carPolygon(run.state.car);
  assert.notDeepEqual(p0, p90, '旋转后应改变世界坐标');
});

test('入位成功：车在车位内且停稳 → win', () => {
  const run = createRun(0);
  run.state.car.x = run.state.bay.x;
  run.state.car.y = run.state.bay.y;
  run.state.car.heading = 0;
  run.state.car.speed = 0;
  run.step(1 / 60);
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 1 && run.state.stars <= 3);
  assert.ok(drainTypes(run).has('win'));
});

test('碰撞失败：撞上障碍 → lost', () => {
  const run = createRun(0);
  run.state.car.x = run.state.obstacles[0].x;
  run.state.car.y = run.state.obstacles[0].y;
  run.state.car.heading = 0;
  run.state.car.speed = 10;
  run.step(1 / 60);
  assert.equal(run.state.phase, 'lost');
});

test('护盾：碰撞被吸收，不判负', () => {
  const run = createRun(0);
  run.state.shield = 1;
  run.state.car.x = run.state.obstacles[0].x;
  run.state.car.y = run.state.obstacles[0].y;
  run.state.car.heading = 0;
  run.state.car.speed = 10;
  run.step(1 / 60);
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.shield, 0);
  assert.ok(drainTypes(run).has('shieldBreak'));
});

test('能量球：靠近后收集并计数', () => {
  const run = createRun(0);
  const orb = run.state.orbs[0];
  run.state.car.x = orb.x;
  run.state.car.y = orb.y;
  run.step(1 / 60);
  assert.equal(run.state.orbsCollected, 1);
  assert.ok(drainTypes(run).has('orb'));
});

test('超时：90 秒后判负', () => {
  const run = createRun(0);
  run.state.time = 89.99;
  run.step(1 / 60);
  assert.equal(run.state.phase, 'timeout');
});

test('setInput：变化返回 true，相同返回 false', () => {
  const run = createRun(0);
  assert.equal(run.setInput({ throttle: 1 }), true);
  assert.equal(run.setInput({ throttle: 1 }), false);
});

test('autopilot：可自动通关全部三关', () => {
  for (let i = 0; i < 3; i += 1) {
    const run = createRun(i);
    let guard = 60 * 95;
    while (guard-- > 0 && run.state.phase === 'playing') {
      run.setInput(autopilotControl(run.state));
      run.step(1 / 60);
      run.drainEvents();
    }
    assert.equal(run.state.phase, 'won', `第 ${i + 1} 关应可自动通关`);
  }
});
