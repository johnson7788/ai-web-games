import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, computeLanding, mulberry32 } from '../src/game/sim.js';
import { HERO } from '../config/game.config.js';

function land(run) {
  // 单跳时长 = 2*LAUNCH_SPEED/GRAVITY = 1.6s；一步跨过整跳触发落地结算
  run.step(2.0);
}

test('初始处于瞄准阶段，第 1 关', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.state.phase, 'aim');
  assert.equal(run.state.level, 1);
  assert.equal(run.state.hero.E, HERO.E0);
});

test('完美发射（角度 0）进入飞行并产出 launch+perfect 事件', () => {
  const run = createRun(0, { seed: 1 });
  run.setAim(0);
  assert.equal(run.launch().ok, true);
  assert.equal(run.state.phase, 'flying');
  const types = run.drainEvents().map((e) => e.type);
  assert.ok(types.includes('launch'));
  assert.ok(types.includes('perfect'));
});

test('糟糕发射（角度 30）没有 perfect 事件', () => {
  const run = createRun(0, { seed: 1 });
  run.setAim(30);
  run.launch();
  const types = run.drainEvents().map((e) => e.type);
  assert.ok(types.includes('launch'));
  assert.ok(!types.includes('perfect'));
});

test('steer 生效，drop 之后锁定转向', () => {
  const run = createRun(0, { seed: 1 });
  run.setAim(0);
  run.launch();
  assert.equal(run.steer(1).ok, true);
  assert.equal(run.state.hop.lean, 1);
  assert.equal(run.drop().ok, true);
  assert.equal(run.steer(-1).ok, false); // 下砸锁定
});

test('落地后爬升且弹力衰减（无弹簧）', () => {
  const run = createRun(0, { seed: 1 });
  run.setAim(0);
  run.launch();
  const y0 = run.state.hero.y;
  const e0 = run.state.hero.E;
  land(run);
  assert.ok(run.state.hero.y > y0, '应该向上爬升');
  assert.ok(run.state.hero.E < e0, '弹力应该衰减');
});

test('弹簧重置弹力到满', () => {
  const run = createRun(0, { seed: 1 });
  run.setAim(0);
  run.launch();
  run.state.hero.E = 40;
  // 注入一个弹簧到即将落地位置
  const { nx, ny } = computeLanding(run.state.hero, run.state.hop);
  run.state.elements.push({ type: 'spring', x: nx, y: ny, r: 60 });
  land(run);
  assert.equal(run.state.hero.E, HERO.E0);
  assert.equal(run.state.springs, 1);
});

test('落地砸进地雷 → 失败（hazard）', () => {
  const run = createRun(0, { seed: 1 });
  run.setAim(0);
  run.launch();
  const { nx, ny } = computeLanding(run.state.hero, run.state.hop);
  run.state.elements.push({ type: 'hazard', x: nx, y: ny, r: 60 });
  land(run);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.reason, 'hazard');
  const types = run.drainEvents().map((e) => e.type);
  assert.ok(types.includes('die'));
});

test('弹力耗尽 → 失败（depleted）', () => {
  const run = createRun(0, { seed: 1 });
  run.setAim(0);
  run.launch();
  run.state.hero.E = HERO.EMIN + 0.5;
  land(run);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.reason, 'depleted');
});

test('到达关卡线 → 推进到下一关', () => {
  const run = createRun(0, { seed: 1 });
  run.setAim(0);
  run.launch();
  // 直接放到关卡线之上一点点，落地即过关
  run.state.hero.y = 3200;
  run.state.hop.y0 = 3200;
  run.state.hero.E = HERO.E0;
  land(run);
  assert.equal(run.state.level, 2);
  const types = run.drainEvents().map((e) => e.type);
  assert.ok(types.includes('levelClear'));
});

test('同一 seed 的事件序列确定一致', () => {
  const a = createRun(0, { seed: 42 });
  const b = createRun(0, { seed: 42 });
  a.setAim(0); b.setAim(0);
  a.launch(); b.launch();
  const sa = JSON.stringify(a.drainEvents());
  const sb = JSON.stringify(b.drainEvents());
  assert.equal(sa, sb);
});

test('撞墙会反弹（computeLanding 夹紧 + 反号）', () => {
  const hero = { E: 100, theta: 40, lean: 1 };
  const hop = { x0: 1200, y0: 0, theta: 40, lean: 1 };
  const { nx, ntheta } = computeLanding(hero, hop);
  assert.ok(nx <= HERO.MAX_X);
  assert.ok(Math.abs(ntheta) < 40, '撞墙后角度应反弹');
});

test('getHud 返回关卡/分数/高度', () => {
  const run = createRun(0, { seed: 1 });
  run.setAim(0);
  run.launch();
  land(run);
  const hud = run.getHud();
  assert.equal(typeof hud.level, 'number');
  assert.equal(typeof hud.score, 'number');
  assert.equal(typeof hud.altitude, 'number');
});

test('mulberry32 在固定 seed 下可复现', () => {
  const r1 = mulberry32(7);
  const r2 = mulberry32(7);
  assert.equal(r1(), r2());
  assert.equal(r1(), r2());
});
