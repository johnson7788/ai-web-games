import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, distanceToEdge } from '../src/game/sim.js';
import { ARENAS, CLOUD_RING, CANDY_WORKS, FROZEN_LAKE } from '../config/arenas.js';
import { CHARACTERS } from '../config/characters.js';
import { CONFIG, STEP } from '../config/game.config.js';

const idle = { mx: 0, mz: 0, jump: false, dash: false, punch: false, grab: false, charge: false };
const intents = (sim, player = idle) => new Map(sim.fighters.map((fighter) => [fighter.id, fighter.id === 'f0' ? player : idle]));
const makeSim = (arena) => createSim({ arena, characters: CHARACTERS, bots: 0, seed: 7 });

test('三张地图数据完整且使用 M6.6 放大尺寸', () => {
  assert.deepEqual(ARENAS.map((arena) => arena.id), ['cloud-ring', 'candy-works', 'frozen-lake']);
  assert.equal(CLOUD_RING.shape, 'circle');
  assert.equal(CLOUD_RING.radius, 11.5);
  assert.equal(CANDY_WORKS.shape, 'rect');
  assert.deepEqual([CANDY_WORKS.width, CANDY_WORKS.depth, CANDY_WORKS.radius], [26, 16, 13]);
  assert.equal(FROZEN_LAKE.radius, 13);
  assert.equal(FROZEN_LAKE.friction, 0.22);
  for (const arena of ARENAS) {
    assert.equal(arena.spawns.length, 8);
    for (const spawn of arena.spawns) {
      assert.ok(distanceToEdge(spawn, arena) >= CONFIG.physics.fighterRadius + CONFIG.physics.edgeMargin);
    }
  }
});

test('圆形与矩形 distanceToEdge 使用最近可掉落边', () => {
  assert.equal(distanceToEdge({ x: 3, z: 0 }, CLOUD_RING), 8.5);
  assert.equal(distanceToEdge({ x: 8, z: 4 }, CANDY_WORKS), 4);
  assert.equal(distanceToEdge({ x: 9, z: 0 }, CANDY_WORKS), 4);
});

test('28 秒开始缩圈，圆形与矩形都按比例收缩', () => {
  assert.equal(CONFIG.match.shrinkStart, 28);
  assert.equal(CONFIG.match.shrinkDuration, 18);
  const circle = makeSim(CLOUD_RING);
  const rect = makeSim(CANDY_WORKS);
  for (const sim of [circle, rect]) sim.fighters[0].pos = { x: 0, y: 0, z: 5.5 };
  for (let frame = 0; frame < 30 * 60; frame++) {
    circle.fighters[0].pos = { x: 0, y: 0, z: 0 };
    rect.fighters[0].pos = { x: 0, y: 0, z: 5.5 };
    circle.step(STEP, intents(circle));
    rect.step(STEP, intents(rect));
  }
  assert.ok(circle.arenaRadius < CLOUD_RING.radius);
  assert.ok(rect.arenaWidth < CANDY_WORKS.width);
  assert.ok(rect.arenaDepth < CANDY_WORKS.depth);
  assert.ok(Math.abs(rect.arenaWidth / rect.arenaDepth - CANDY_WORKS.width / CANDY_WORKS.depth) < 1e-9);
});

test('糖果传送带以配置速度把角色推向边缘且可逆行', () => {
  const sim = makeSim(CANDY_WORKS);
  const fighter = sim.fighters[0];
  fighter.pos = { x: 0, y: 0, z: 5.5 };
  const startX = fighter.pos.x;
  sim.step(STEP, intents(sim));
  assert.ok(Math.abs(fighter.pos.x - startX - 1.6 * STEP) < 1e-9);
  for (let frame = 0; frame < 60; frame++) sim.step(STEP, intents(sim, { ...idle, mx: -1 }));
  assert.ok(fighter.vel.x < 0);
});

test('旋转糖棒命中造成 14 击飞、30 韧性和 0.3 秒硬直', () => {
  const sim = makeSim(CANDY_WORKS);
  const fighter = sim.fighters[0];
  const sweeper = CANDY_WORKS.hazards.find((hazard) => hazard.type === 'sweeper');
  fighter.pos = { x: sweeper.x, y: 0, z: sweeper.z + 2 };
  sim.step(STEP, intents(sim));
  assert.equal(fighter.poise, CONFIG.combat.poise - 30);
  assert.equal(fighter.lastHitBy, 'sweeper0');
  assert.ok(fighter.staggerT >= 0.3 - STEP);
  assert.ok(Math.hypot(fighter.vel.x, fighter.vel.z) > 10);
  assert.ok(sim.events.some((event) => event.type === 'hazardHit'));
});

test('冰面加速度为正常的 0.55 倍、减速度为 0.18 倍', () => {
  const cloud = makeSim(CLOUD_RING);
  const ice = makeSim(FROZEN_LAKE);
  for (const sim of [cloud, ice]) sim.fighters[0].pos = { x: 0, y: 0, z: 0 };
  cloud.step(STEP, intents(cloud, { ...idle, mx: 1 }));
  ice.step(STEP, intents(ice, { ...idle, mx: 1 }));
  assert.ok(Math.abs(ice.fighters[0].vel.x / cloud.fighters[0].vel.x - 0.55) < 1e-9);
  cloud.fighters[0].vel.x = 4;
  ice.fighters[0].vel.x = 4;
  cloud.step(STEP, intents(cloud));
  ice.step(STEP, intents(ice));
  const cloudDrop = 4 - cloud.fighters[0].vel.x;
  const iceDrop = 4 - ice.fighters[0].vel.x;
  assert.ok(Math.abs(iceDrop / cloudDrop - 0.18) < 1e-9);
});
