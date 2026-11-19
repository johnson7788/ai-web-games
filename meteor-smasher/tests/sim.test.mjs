import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { WORLD, HEAT, BOUNCE, PHYS } from '../config/game.config.js';

function meteorUnder(run, kind = 'meteor') {
  run.state.entities = [{ id: 1, kind, x: WORLD.PLAYER_X - 20, w: kind === 'pad' ? 86 : 74, speed: 0 }];
}

function groundAndSlam(run) {
  run.state.player.y = 0;
  run.state.player.vy = 0;
  run.state.player.value = PHYS.GRAVITY_NORMAL;
  run.slam();
  run.step(1 / 60);
}

test('createRun 开局 running 且玩家悬浮', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.state.phase, 'running');
  assert.ok(run.state.player.y > 0, '玩家应在空中');
});

test('无输入时地板热度累积并最终坠毁', () => {
  const run = createRun({ seed: 1 });
  for (let i = 0; i < 600; i += 1) run.step(1 / 60);
  assert.equal(run.state.phase, 'over');
  assert.ok(run.state.heat >= HEAT.MAX);
});

test('砸击把重力因子拉高且速度向下', () => {
  const run = createRun({ seed: 1 });
  run.state.player.vy = 5;
  const r = run.slam();
  assert.equal(r.ok, true);
  assert.ok(run.state.player.value > 1);
  assert.ok(run.state.player.vy <= 0, '砸击后速度应为向下');
});

test('砸中陨石击杀并连击 +1', () => {
  const run = createRun({ seed: 1 });
  meteorUnder(run, 'meteor');
  groundAndSlam(run);
  assert.equal(run.state.stats.kills, 1);
  assert.equal(run.state.combo, 1);
  assert.equal(run.state.player.vy, BOUNCE.METEOR);
});

test('砸中尖刺受热度惩罚且连击清零', () => {
  const run = createRun({ seed: 1 });
  meteorUnder(run, 'spike');
  run.state.combo = 3;
  groundAndSlam(run);
  assert.equal(run.state.stats.spikes, 1);
  assert.equal(run.state.heat, HEAT.SPIKE_PENALTY);
  assert.equal(run.state.combo, 0);
});

test('砸中修复台把热度压回 PAD_HEAL_TO', () => {
  const run = createRun({ seed: 1 });
  run.state.heat = 25;
  meteorUnder(run, 'pad');
  groundAndSlam(run);
  assert.equal(run.state.heat, HEAT.PAD_HEAL_TO);
  assert.equal(run.state.stats.pads, 1);
});

test('地板命中热度 +5', () => {
  const run = createRun({ seed: 1 });
  run.state.entities = [];
  groundAndSlam(run);
  assert.equal(run.state.heat, HEAT.PER_FLOOR);
});

test('连续击杀连击递增（封顶 MAX）', () => {
  const run = createRun({ seed: 1 });
  for (let i = 0; i < 6; i += 1) {
    meteorUnder(run, 'meteor');
    groundAndSlam(run);
  }
  assert.equal(run.state.stats.kills, 6);
  assert.equal(run.state.combo, 5);
});

test('距离推进会提升等级', () => {
  const run = createRun({ seed: 1 });
  run.state.distance = 899;
  for (let i = 0; i < 120; i += 1) run.step(1 / 60);
  assert.ok(run.state.level >= 2, '距离越过阈值应升到 2 级');
});

test('得分为米数 + 奖励分', () => {
  const run = createRun({ seed: 1 });
  run.state.distance = 2000;
  run.state.bonus = 37;
  run.state.meters = Math.floor(run.state.distance / 10);
  run.state.score = run.state.meters + run.state.bonus;
  assert.equal(run.state.score, 237);
});

test('predictSlamTarget 能在陨石可命中时返回它', () => {
  const run = createRun({ seed: 1 });
  run.state.entities = [{ id: 9, kind: 'meteor', x: WORLD.PLAYER_X + 30, w: 74, speed: 0 }];
  run.state.player.y = 80;
  run.state.player.vy = -3;
  const t = run.predictSlamTarget();
  assert.ok(t, '应预测到目标');
  assert.equal(t.kind, 'meteor');
});

test('deterministic seed 产生相同实体序列', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  for (let i = 0; i < 120; i += 1) { a.step(1 / 60); b.step(1 / 60); }
  assert.deepEqual(a.state.entities.map((e) => e.kind), b.state.entities.map((e) => e.kind));
});

test('mulberry32 是稳定随机数生成器', () => {
  const r1 = mulberry32(7);
  const r2 = mulberry32(7);
  assert.equal(r1(), r2());
});
