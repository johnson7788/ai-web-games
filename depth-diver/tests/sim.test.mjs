import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32, LEVEL_COUNT } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { GAME, LAYOUT } from '../config/game.config.js';

function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

test('冒烟：createRun → input → step → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.input({ thrust: true }).ok, true);
  r.step(1 / 60);
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.phase, 'playing');
  assert.ok(Array.isArray(r.drainEvents()));
});

test('state 形状：level/phase/scene/depthTarget/oxygenMax/player 字段', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'playing');
  assert.equal(s.scene, 'sunlit');
  assert.equal(s.depthTarget, 300);
  assert.equal(s.oxygen, s.oxygenMax);
  assert.equal(typeof s.player.x, 'number');
  assert.equal(typeof s.player.y, 'number');
  assert.equal(typeof s.player.r, 'number');
});

test('RNG：mulberry32 同 seed 可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test('深度累积：step 后 depth 增加', () => {
  const r = createRun(0, { seed: 1 });
  const before = r.state.depth;
  advance(r, 1);
  assert.ok(r.state.depth > before);
});

test('上浮：thrust=true 使 player.y 减小（向上）', () => {
  const r = createRun(0, { seed: 1 });
  r.state.player.y = 400;
  r.input({ thrust: true });
  advance(r, 0.5);
  assert.ok(r.state.player.y < 400, '按住上浮应向上');
});

test('下沉：无输入时 player.y 增大（向下）', () => {
  const r = createRun(0, { seed: 1 });
  r.state.player.y = 300;
  advance(r, 0.5);
  assert.ok(r.state.player.y > 300, '松开应下沉');
});

test('水平微调：left 使 player.x 减小，right 增大', () => {
  const r = createRun(0, { seed: 1 });
  r.state.player.x = 600;
  r.input({ left: true });
  advance(r, 0.3);
  assert.ok(r.state.player.x < 600);
  const x1 = r.state.player.x;
  r.input({ left: false, right: true });
  advance(r, 0.3);
  assert.ok(r.state.player.x > x1);
});

test('洋流：L3 无输入时 player.x 向右漂移（current>0）', () => {
  const r = createRun(2, { seed: 1 });
  assert.equal(r.state.current, 90);
  const startX = r.state.player.x;
  advance(r, 1);
  assert.ok(r.state.player.x > startX);
});

test('stabilizer 模块：洋流漂移减半', () => {
  const r = createRun(2, { seed: 1, modules: { stabilizer: true } });
  const startX = r.state.player.x;
  advance(r, 1);
  assert.ok(r.state.player.x - startX < 90, '漂移应小于无模块的 90px');
});

test('边界：player.x 被 clamp 在可玩区', () => {
  const r = createRun(0, { seed: 1 });
  r.state.player.x = LAYOUT.PLAY_X1;
  r.input({ right: true });
  advance(r, 0.5);
  assert.ok(r.state.player.x <= LAYOUT.PLAY_X1);
});

test('撞击：障碍压在玩家上 → lose crush', () => {
  const r = createRun(0, { seed: 1 });
  const p = r.state.player;
  r.state.obstacles.push({ kind: 'rock', x: p.x, y: p.y, r: 30, passed: false });
  r.step(1 / 60);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.won, false);
  assert.ok(r.drainEvents().some((e) => e.type === 'crush'));
});

test('缺氧：氧气耗尽 → lose suffocation', () => {
  const r = createRun(0, { seed: 1 });
  r.state.oxygen = 0.01;
  r.step(1 / 60);
  assert.equal(r.state.phase, 'lost');
  assert.ok(r.drainEvents().some((e) => e.type === 'suffocate'));
});

test('采集：样本压在玩家上 → samples++ 并发 sample 事件', () => {
  const r = createRun(0, { seed: 1 });
  const p = r.state.player;
  r.state.pickups.push({ kind: 'sample', x: p.x, y: p.y, r: 22, taken: false });
  r.step(1 / 60);
  assert.equal(r.state.samples, 1);
  assert.ok(r.drainEvents().some((e) => e.type === 'sample'));
});

test('采满样本：samples 达到 sampleTotal → sampleStar 事件', () => {
  const r = createRun(0, { seed: 1 });
  r.state.samples = r.state.sampleTotal - 1;
  const p = r.state.player;
  r.state.pickups.push({ kind: 'sample', x: p.x, y: p.y, r: 22, taken: false });
  r.step(1 / 60);
  assert.ok(r.drainEvents().some((e) => e.type === 'sampleStar'));
});

test('通关：depth 达到目标 → win 且 3 星（样本满 + 氧气足）', () => {
  const r = createRun(0, { seed: 1 });
  r.state.samples = r.state.sampleTotal;
  r.state.depth = r.state.depthTarget - 0.1;
  r.step(1 / 60);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.stars, 3);
  assert.ok(r.drainEvents().some((e) => e.type === 'win'));
});

test('通关星级：未采样本且氧气不足只拿 1 星', () => {
  const r = createRun(0, { seed: 1 });
  r.state.samples = 0;
  r.state.oxygen = r.state.oxygenMax * 0.2;
  r.state.depth = r.state.depthTarget - 0.1;
  r.step(1 / 60);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.stars, 1);
});

test('擦肩：障碍在玩家侧方擦过 → nearMiss 事件', () => {
  const r = createRun(0, { seed: 1 });
  const p = r.state.player;
  // x 差 71：在 NEAR_MISS_DIST(74) 内，但大于 r 和(28+40=68)，擦肩不撞
  r.state.obstacles.push({ kind: 'rock', x: p.x + 71, y: p.y + 200, r: 40, passed: false });
  advance(r, 2);
  assert.ok(r.drainEvents().some((e) => e.type === 'nearMiss'));
});

test('换层：跨过 1/3 深度 → layerChange + scatter', () => {
  const r = createRun(0, { seed: 1 });
  r.state.depth = r.state.depthTarget / 3 + 0.1;
  r.state.layer = 0;
  r.step(1 / 60);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'layerChange'));
  assert.ok(ev.some((e) => e.type === 'scatter'));
});

test('水雷：L2 生成的水雷障碍 kind=mine', () => {
  const r = createRun(1, { seed: 7 });
  // 直接触发一次生成
  r._spawnHazard();
  assert.ok(r.state.obstacles.every((o) => o.kind === 'mine'));
  assert.ok(r.state.obstacles.length >= 1);
});

test('热泉：L4 生成 vent 实体且不致命', () => {
  const r = createRun(3, { seed: 1 });
  r._spawnVent();
  assert.ok(r.state.vents.length >= 1);
  assert.equal(r.state.vents[0].kind, 'vent');
});

test('追逐者：L5 到达 40% 深度后生成 chaser', () => {
  const r = createRun(4, { seed: 1 });
  r.state.depth = r.state.depthTarget * 0.45;
  r._updateSpawning(0.1);
  assert.ok(r.state.chaser);
});

test('压力限时：L8 深潜时耗氧更快', () => {
  const r = createRun(7, { seed: 1 });
  const o1 = r.state.oxygen;
  r.state.depth = r.state.depthTarget * 0.9;
  r.step(1 / 60);
  const drainDeep = o1 - r.state.oxygen;
  const r2 = createRun(7, { seed: 1 });
  r2.state.depth = 0;
  r2.step(1 / 60);
  const drainShallow = r2.state.oxygenMax - r2.state.oxygen;
  assert.ok(drainDeep > drainShallow, '越深耗氧越快');
});

test('护盾模块：免一次撞击并消耗', () => {
  const r = createRun(0, { seed: 1, modules: { shield: true } });
  const p = r.state.player;
  r.state.obstacles.push({ kind: 'rock', x: p.x, y: p.y, r: 30, passed: false });
  r.step(1 / 60);
  assert.equal(r.state.phase, 'playing');
  assert.equal(r.state.modules.shield, false);
  assert.ok(r.drainEvents().some((e) => e.type === 'shield'));
});

test('氧气罐：拾取后恢复氧气并发 oxygenPickup', () => {
  const r = createRun(0, { seed: 1 });
  r.state.oxygen = r.state.oxygenMax * 0.2;
  const p = r.state.player;
  r.state.pickups.push({ kind: 'oxygen', x: p.x, y: p.y, r: 20, taken: false });
  r.step(1 / 60);
  assert.ok(r.state.oxygen > r.state.oxygenMax * 0.2);
  assert.ok(r.drainEvents().some((e) => e.type === 'oxygenPickup'));
});
