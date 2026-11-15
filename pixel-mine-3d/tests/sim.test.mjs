import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSim, updateSim, getHud, drainEvents, buyUpgrade, recallToCamp, finish,
} from '../src/game/sim.js';
import { WORLD, T, GOAL, UPGRADES } from '../config/game.config.js';

const idx = (x, y, z) => (y * WORLD.W + x) * WORLD.D + z;
const idle = { yaw: 0, pitch: 0, f: 0, s: 0, jump: false, mine: false, place: false, target: null };
const mineBlock = (sim, target, frames = 60) => {
  for (let i = 0; i < frames; i++) updateSim(sim, { ...idle, mine: true, target });
  return drainEvents(sim);
};

test('世界：地表出生点下方是土', () => {
  const s = createSim({ seed: 1 });
  assert.equal(s.blocks[idx(24, 0, 24)], T.DIRT);
});

test('世界：按深度分层（石/煤/铁/金/钻/基岩）', () => {
  const s = createSim({ seed: 1 });
  assert.equal(s.blocks[idx(10, 10, 10)], T.STONE);
  assert.equal(s.blocks[idx(10, 52, 10)], T.BEDROCK);
});

test('世界：出生点正下方是软石裂缝（可挖穿基岩）', () => {
  const s = createSim({ seed: 1 });
  assert.equal(s.blocks[idx(24, 52, 24)], T.STONE);
});

test('世界：宝藏房是空腔，地板是宝藏块', () => {
  const s = createSim({ seed: 1 });
  assert.equal(s.blocks[idx(24, 58, 24)], T.AIR);
  assert.equal(s.blocks[idx(24, 63, 24)], T.TREASURE);
});

test('世界：同 seed 生成确定性一致', () => {
  const a = createSim({ seed: 7 });
  const b = createSim({ seed: 7 });
  assert.deepEqual(Array.from(a.blocks), Array.from(b.blocks));
});

test('移动：向前（yaw=0）z 减小', () => {
  const s = createSim({ seed: 1 });
  const z0 = s.player.z;
  for (let i = 0; i < 10; i++) updateSim(s, { ...idle, f: 1 });
  assert.ok(s.player.z < z0, 'z 应该减小（向前 = -z）');
  assert.ok(s.stats.moved, '应标记已移动');
});

test('跳跃：vy 向上（>0）并离开地面', () => {
  const s = createSim({ seed: 1 });
  updateSim(s, { ...idle, jump: true });
  assert.ok(s.player.vy > 0, 'vy 应该为正（向上）');
  assert.ok(!s.player.onGround, '应该离开地面');
});

test('重力：空中落下回到地表', () => {
  const s = createSim({ seed: 1 });
  s.player.y = 5; s.player.onGround = false;
  for (let i = 0; i < 180; i++) updateSim(s, idle);
  assert.ok(s.player.onGround, '应该落回地面');
  assert.ok(Math.abs(s.player.y) < 0.2, 'y 应接近 0');
});

test('挖掘：挖掉地表土块 → 变空气 + 进背包', () => {
  const s = createSim({ seed: 1 });
  const ev = mineBlock(s, [24, 0, 24], 60);
  assert.equal(s.blocks[idx(24, 0, 24)], T.AIR);
  assert.equal(getHud(s).inv, 1, '背包应有 1 块');
  assert.ok(ev.some((e) => e.type === 'block_break'));
  assert.ok(ev.some((e) => e.type === 'crack'));
});

test('挖掘：煤矿触发 ore_collect', () => {
  const s = createSim({ seed: 1 });
  const ev = mineBlock(s, [23, 17, 24], 120);
  assert.ok(ev.some((e) => e.type === 'ore_collect'), '应收集矿石');
});

test('出售：走到卖矿台自动结算', () => {
  const s = createSim({ seed: 1 });
  mineBlock(s, [24, 0, 24], 60);
  assert.equal(getHud(s).inv, 1);
  s.player.x = WORLD.SELL[0]; s.player.z = WORLD.SELL[2]; s.player.y = 0;
  const ev = drainEvents(s);
  updateSim(s, idle);
  const ev2 = drainEvents(s);
  assert.ok(ev2.some((e) => e.type === 'sell'), '应触发卖出');
  assert.equal(getHud(s).inv, 0);
  assert.ok(getHud(s).coins > 0);
});

test('背包：基础容量 20，买背包升级扩容', () => {
  const s = createSim({ seed: 1 });
  assert.equal(getHud(s).capacity, 20);
  s.coins = 100;
  buyUpgrade(s, 'pack');
  assert.equal(getHud(s).capacity, 20 + UPGRADES.pack.per);
});

test('升级：镐速扣钱生效', () => {
  const s = createSim({ seed: 1 });
  s.coins = 100;
  const r = buyUpgrade(s, 'pick');
  assert.ok(r.ok);
  assert.equal(s.coins, 100 - UPGRADES.pick.costs[0]);
  assert.equal(getHud(s).pickLevel, 1);
});

test('升级：满级后不能再买', () => {
  const s = createSim({ seed: 1 });
  s.coins = 99999;
  for (let i = 0; i < UPGRADES.pick.levels; i++) buyUpgrade(s, 'pick');
  const r = buyUpgrade(s, 'pick');
  assert.ok(r.maxed, '应判定满级');
});

test('体力：挖矿消耗体力，0 时强制回营地并掉一半矿', () => {
  const s = createSim({ seed: 1 });
  mineBlock(s, [24, 0, 24], 60); // 先挖一块，背包有货
  s.player.stamina = 0.1;
  const ev = mineBlock(s, [24, 0, 23], 5); // 体力耗尽
  assert.ok(ev.some((e) => e.type === 'forced_return'), '应强制回营地');
  assert.equal(s.stats.deaths, 1);
  assert.equal(s.player.y, 0, '应传送回地表');
});

test('目标：到达目标深度给奖励', () => {
  const s = createSim({ seed: 1 });
  s.depthMax = GOAL.target;
  const ev = drainEvents(s);
  updateSim(s, idle);
  const ev2 = drainEvents(s);
  assert.ok(s.goalDone, '目标应完成');
  assert.ok(ev2.some((e) => e.type === 'goal_complete'));
  assert.equal(s.coins, GOAL.reward);
});

test('终局：挖到宝藏块 → win + phase finished', () => {
  const s = createSim({ seed: 1 });
  const ev = mineBlock(s, [24, 63, 24], 60);
  assert.ok(s.treasureFound);
  assert.equal(s.phase, 'finished');
  assert.ok(ev.some((e) => e.type === 'treasure_found'));
  assert.ok(ev.some((e) => e.type === 'win'));
});

test('放梯：在竖井墙面放梯子', () => {
  const s = createSim({ seed: 1 });
  mineBlock(s, [24, 0, 24], 60);
  mineBlock(s, [24, 1, 24], 60);
  for (let i = 0; i < 3; i++) updateSim(s, { ...idle, yaw: 0, pitch: 0, place: true });
  let ladders = 0;
  for (let y = 0; y < WORLD.H; y++) for (let x = 0; x < WORLD.W; x++) for (let z = 0; z < WORLD.D; z++) {
    if (s.blocks[idx(x, y, z)] === T.LADDER) ladders++;
  }
  assert.ok(ladders >= 1, '竖井里应有梯子');
});

test('主动回营地：保留背包、传送回地表', () => {
  const s = createSim({ seed: 1 });
  mineBlock(s, [24, 0, 24], 60);
  s.player.y = -10;
  recallToCamp(s, true);
  assert.equal(s.player.y, 0);
  assert.equal(getHud(s).inv, 1, '主动回营地不掉矿');
});

test('收工：结算并清空背包', () => {
  const s = createSim({ seed: 1 });
  mineBlock(s, [24, 0, 24], 60);
  finish(s);
  assert.equal(s.phase, 'finished');
  assert.equal(getHud(s).inv, 0);
});

test('getHud 字段完整', () => {
  const s = createSim({ seed: 1 });
  const h = getHud(s);
  for (const k of ['coins', 'depth', 'stamina', 'staminaMax', 'inv', 'capacity', 'level', 'goal', 'phase']) {
    assert.ok(k in h, `缺字段 ${k}`);
  }
});

test('drainEvents 清空队列', () => {
  const s = createSim({ seed: 1 });
  mineBlock(s, [24, 0, 24], 60);
  assert.ok(drainEvents(s).length === 0, '第二次应清空');
});

test('层数映射：越深 level 越大', () => {
  const s = createSim({ seed: 1 });
  assert.equal(getHud(s).level, 1);
  s.player.y = -20; s.player.z = 10; s.player.x = 10;
  updateSim(s, idle);
  assert.ok(getHud(s).level >= 3, '深度 20 应到第 3 层');
});
