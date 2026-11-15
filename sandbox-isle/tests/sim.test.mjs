import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSim, updateSim, getHud, drainEvents, getBlock, setBlock, raycast, mulberry32, buildBridge, forceWin,
} from '../src/game/sim.js';
import { WORLD, BLOCKS, BLOCK_DEFS, STAMINA, RAINBOW, ANIMALS, FARM, STEP } from '../config/game.config.js';

function blockAt(sim, x, y, z) { return getBlock(sim.world, x, y, z); }
function digAt(sim, x, y, z) { return updateSim(sim, { action: { kind: 'dig', x, y, z } }); }

test('世界尺寸是 32×24×32', () => {
  const sim = createSim({ seed: 1 });
  assert.equal(sim.world.length, WORLD.W * WORLD.H * WORLD.D);
});

test('seed 回归：同 seed 生成相同世界', () => {
  const a = createSim({ seed: 7 });
  const b = createSim({ seed: 7 });
  for (let i = 0; i < a.world.length; i += 997) {
    assert.equal(a.world[i], b.world[i]);
  }
});

test('不同 seed 生成不同世界', () => {
  const a = createSim({ seed: 1 });
  const b = createSim({ seed: 2 });
  let diff = false;
  for (let i = 0; i < a.world.length; i++) if (a.world[i] !== b.world[i]) { diff = true; break; }
  assert.ok(diff);
});

test('mulberry32 确定性', () => {
  const r1 = mulberry32(42), r2 = mulberry32(42);
  for (let i = 0; i < 10; i++) assert.equal(r1(), r2());
});

test('挖石头：block 变 AIR，入背包，扣体力', () => {
  const sim = createSim({ seed: 1 });
  const p = sim.player;
  const ty = Math.floor(p.y);
  setBlock(sim.world, 17, ty, 16, BLOCKS.STONE);
  const before = p.stamina;
  digAt(sim, 17, ty, 16);
  assert.equal(blockAt(sim, 17, ty, 16), BLOCKS.AIR);
  assert.equal(p.inventory[BLOCKS.STONE], 1);
  assert.ok(Math.abs(p.stamina - (before - STAMINA.digCost)) < 1);
  assert.equal(sim.stats.stonesDug, 1);
});

test('体力耗尽挖矿 → 累晕（deaths+1，方块保留）', () => {
  const sim = createSim({ seed: 1 });
  const p = sim.player;
  const ty = Math.floor(p.y);
  setBlock(sim.world, 17, ty, 16, BLOCKS.STONE);
  p.stamina = 1;
  digAt(sim, 17, ty, 16);
  assert.equal(sim.stats.deaths, 1);
  assert.equal(blockAt(sim, 17, ty, 16), BLOCKS.STONE);
  assert.ok(Math.abs(p.stamina - 60) < 1);
});

test('挖水（流体）不成功', () => {
  const sim = createSim({ seed: 1 });
  const p = sim.player;
  const ty = Math.floor(p.y);
  setBlock(sim.world, 17, ty, 16, BLOCKS.WATER);
  digAt(sim, 17, ty, 16);
  assert.equal(blockAt(sim, 17, ty, 16), BLOCKS.WATER);
});

test('超距挖掘不生效', () => {
  const sim = createSim({ seed: 1 });
  setBlock(sim.world, 2, 3, 2, BLOCKS.STONE);
  digAt(sim, 2, 3, 2);
  assert.equal(blockAt(sim, 2, 3, 2), BLOCKS.STONE);
});

test('放置方块：消耗库存，落位正确', () => {
  const sim = createSim({ seed: 1 });
  const p = sim.player;
  const ty = Math.floor(p.y);
  setBlock(sim.world, 17, ty, 16, BLOCKS.AIR);
  p.inventory[BLOCKS.STONE] = 5;
  updateSim(sim, { slot: 2, action: { kind: 'place', x: 17, y: ty, z: 16, block: BLOCKS.STONE } });
  assert.equal(blockAt(sim, 17, ty, 16), BLOCKS.STONE);
  assert.equal(p.inventory[BLOCKS.STONE], 4);
});

test('没有库存不能放置', () => {
  const sim = createSim({ seed: 1 });
  const p = sim.player;
  const ty = Math.floor(p.y);
  setBlock(sim.world, 17, ty, 16, BLOCKS.AIR);
  updateSim(sim, { action: { kind: 'place', x: 17, y: ty, z: 16, block: BLOCKS.STONE } });
  assert.equal(blockAt(sim, 17, ty, 16), BLOCKS.AIR);
});

test('喂食：消耗萝卜，动物 fedToday', () => {
  const sim = createSim({ seed: 1 });
  const p = sim.player;
  const a = sim.animals[0];
  a.x = p.x + 1; a.z = p.z; a.y = p.y;
  p.carrots = 3;
  updateSim(sim, { interact: true });
  assert.equal(a.fedToday, true);
  assert.equal(p.carrots, 2);
});

test('收获萝卜：成熟作物 → 萝卜 +1，成熟复位', () => {
  const sim = createSim({ seed: 1 });
  const p = sim.player;
  const c = sim.crops[0];
  c.mature = true;
  p.x = c.x; p.z = c.z;
  p.carrots = 0;
  updateSim(sim, { interact: true });
  assert.equal(p.carrots, 1);
  assert.equal(c.mature, false);
});

test('动物状态机只取 wander/eat/flee', () => {
  const sim = createSim({ seed: 1 });
  for (const a of sim.animals) assert.ok(['wander', 'eat', 'flee'].includes(a.state));
});

test('日更：喂饱的鸡次晨产蛋卖金币', () => {
  const sim = createSim({ seed: 1 });
  const a = sim.animals.find((x) => x.type === 'chicken');
  a.fedToday = true;
  sim.time = WORLD.DAY_SECONDS - STEP / 2;
  updateSim(sim, {});
  assert.equal(sim.day, 1);
  assert.ok(sim.player.gold >= ANIMALS.produce.chicken.gold);
  const evs = drainEvents(sim);
  assert.ok(evs.some((e) => e.type === 'day'));
});

test('目标完成：达标 → done + 金币 + 稀有方块', () => {
  const sim = createSim({ seed: 1 });
  sim.goals = [{ id: 'dig_stone', metric: 'stonesDug', target: 6, done: false, progress: 0, gold: 15 }];
  sim.stats.stonesDug = 6;
  updateSim(sim, {});
  assert.equal(sim.goals[0].done, true);
  assert.ok(sim.player.gold >= 15);
  assert.equal(sim.player.rainbow[RAINBOW.colors[0]], RAINBOW.goalReward);
});

test('彩虹桥材料不足时不能建', () => {
  const sim = createSim({ seed: 1 });
  buildBridge(sim);
  assert.equal(sim.phase, 'playing');
});

test('forceWin：终局结算', () => {
  const sim = createSim({ seed: 1 });
  forceWin(sim);
  assert.equal(sim.phase, 'won');
  assert.equal(sim.canBuild, true);
});

test('raycast 命中固体块', () => {
  const sim = createSim({ seed: 1 });
  const r = raycast(sim, 16, 20, 16, 0, -1, 0, 40);
  assert.equal(r.hit, true);
  assert.ok(BLOCK_DEFS[r.block].solid);
});

test('玩家移动被夹在世界边界内', () => {
  const sim = createSim({ seed: 1 });
  sim.player.x = 0.5; sim.player.z = 8;
  for (let i = 0; i < 30; i++) updateSim(sim, { move: { x: -1, z: 0 } });
  assert.ok(sim.player.x >= 0.49);
});

test('getHud 返回关键字段', () => {
  const sim = createSim({ seed: 1 });
  const h = getHud(sim);
  for (const k of ['time', 'day', 'gold', 'stamina', 'slot', 'goals', 'phase', 'deaths']) {
    assert.ok(k in h, `缺 ${k}`);
  }
  assert.equal(h.goals.length, 3);
});

test('越界 getBlock 返回空气', () => {
  const sim = createSim({ seed: 1 });
  assert.equal(getBlock(sim.world, -1, 0, 0), BLOCKS.AIR);
  assert.equal(getBlock(sim.world, WORLD.W, 0, 0), BLOCKS.AIR);
});
