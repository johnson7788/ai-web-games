import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, restoreState, growthAt, plantById } from '../src/game/sim.js';
import { PLANTS, MAX_STAGE, START } from '../config/game.config.js';

function grow(run, sec) {
  for (let i = 0; i < Math.ceil(sec * 60); i += 1) run.step(1 / 60);
}

test('开局：地块0已解锁并种下1阶花，其余锁定', () => {
  const run = createRun();
  assert.equal(run.state.plots[0].unlocked, true);
  assert.equal(run.state.plots[0].species, 1);
  assert.equal(run.state.plots[1].unlocked, false);
  assert.equal(run.state.gardenLevel, 1);
  assert.equal(run.state.coins, START.coins);
});

test('生长：随时间推移花田积累金币', () => {
  const run = createRun();
  grow(run, 2);
  const info = growthAt(run.state, 0);
  assert.ok(info.accumulated >= 10, `2 秒后应有金币积累，实际 ${info.accumulated}`);
});

test('收获：收集金币并清空当前进度', () => {
  const run = createRun();
  grow(run, 2);
  const before = run.state.coins;
  const res = run.harvest(0);
  assert.equal(res.ok, true);
  assert.ok(res.gained >= 10);
  assert.equal(run.state.coins, before + res.gained);
  assert.equal(run.state.plots[0].stageGold, 0);
});

test('收获：没有金币时失败', () => {
  const run = createRun();
  const res = run.harvest(0);
  assert.equal(res.ok, false);
});

test('升级：花费金币提升等级', () => {
  const run = createRun();
  run.state.coins = 1000;
  const cost = run.state.coins;
  const res = run.upgrade(0);
  assert.equal(res.ok, true);
  assert.equal(run.state.plots[0].level, 2);
  assert.equal(run.state.coins, cost - plantById(1).upCost);
});

test('升级：金币不足时失败', () => {
  const run = createRun();
  run.state.coins = 0;
  assert.equal(run.upgrade(0).ok, false);
});

test('进化：未满级时失败', () => {
  const run = createRun();
  run.state.coins = 10000;
  assert.equal(run.evolve(0).ok, false);
});

test('进化：满级进化成新花种、获得鲜花、提升花园等级', () => {
  const run = createRun();
  run.state.coins = 10000;
  const cfg = plantById(1);
  run.state.plots[0].level = cfg.maxLevel;
  const res = run.evolve(0);
  assert.equal(res.ok, true);
  assert.equal(run.state.plots[0].species, 2);
  assert.equal(run.state.plots[0].level, 1);
  assert.equal(run.state.blooms, 1);
  assert.equal(run.state.gardenLevel, 2);
});

test('解锁地块：鲜花不足时失败', () => {
  const run = createRun();
  run.state.coins = 10000;
  assert.equal(run.unlockPlot(1).ok, false); // needBloom=1
});

test('解锁地块：鲜花达标后花金币解锁并种下1阶花', () => {
  const run = createRun();
  run.state.coins = 10000;
  run.state.blooms = 5;
  const res = run.unlockPlot(1);
  assert.equal(res.ok, true);
  assert.equal(run.state.plots[1].unlocked, true);
  assert.equal(run.state.plots[1].species, 1);
});

test('破岩：得金币并进入重生冷却，随后自动重生', () => {
  const run = createRun();
  const res = run.breakRock(0);
  assert.equal(res.ok, true);
  assert.ok(res.gained >= 20);
  assert.equal(run.state.rocks[0].ready, false);
  grow(run, 7);
  assert.equal(run.state.rocks[0].ready, true);
});

test('水滴：消耗水滴立即结算一轮金币', () => {
  const run = createRun();
  const before = run.state.plots[0].stageGold;
  const res = run.water(0);
  assert.equal(res.ok, true);
  assert.equal(run.state.plots[0].stageGold, before + res.gained);
  assert.equal(run.state.water, START.water - 1);
});

test('连击：窗口内连续收获触发 ×2 倍数', () => {
  const run = createRun();
  run.state.coins = 10000;
  run.state.blooms = 5;
  run.unlockPlot(1); // 第二块地种下 1 阶花
  grow(run, 1.5);    // 两朵都长出金币
  const first = run.harvest(0);
  const second = run.harvest(1);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.ok(second.mult >= 2, `连击倍数应为 2，实际 ${second.mult}`);
});

test('封顶：积累轮数不超过 MAX_STAGE', () => {
  const run = createRun();
  run.state.plots[0].growthStart = -1000; // 模拟长时间离线
  const info = growthAt(run.state, 0);
  assert.ok(info.accumulated <= MAX_STAGE * plantById(1).goldOnce);
});

test('事件：drainEvents 返回并清空事件队列', () => {
  const run = createRun();
  grow(run, 2);
  run.harvest(0);
  const events = run.drainEvents();
  assert.ok(events.some((e) => e.type === 'harvest'));
  assert.equal(run.drainEvents().length, 0);
});

test('存档恢复：序列化后可无损还原关键字段', () => {
  const run = createRun();
  run.state.coins = 777;
  run.state.blooms = 9;
  run.state.plots[2].unlocked = true;
  run.state.plots[2].species = 3;
  const saved = {
    coins: run.state.coins,
    blooms: run.state.blooms,
    water: run.state.water,
    plots: run.state.plots.map((p) => ({ unlocked: p.unlocked, species: p.species, level: p.level, stageGold: p.stageGold })),
  };
  const restored = restoreState(saved);
  assert.equal(restored.state.coins, 777);
  assert.equal(restored.state.blooms, 9);
  assert.equal(restored.state.plots[2].unlocked, true);
  assert.equal(restored.state.plots[2].species, 3);
});

test('存档恢复：坏数据返回 null（降级新开局）', () => {
  assert.equal(restoreState(null), null);
  assert.equal(restoreState({ plots: [] }), null);
});
