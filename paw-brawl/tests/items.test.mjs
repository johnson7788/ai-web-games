import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim } from '../src/game/sim.js';
import { CONFIG, STEP } from '../config/game.config.js';
import { ITEMS, ITEM_RULES } from '../config/items.js';
import { MOVES } from '../config/moves.js';
import { CLOUD_RING } from '../config/arenas.js';
import { CHARACTERS } from '../config/characters.js';

const idle = () => ({ mx: 0, mz: 0, jump: false, dash: false, punch: false, punchHeld: false, grab: false, charge: false });
const makeSim = (bots = 0) => createSim({ arena: CLOUD_RING, characters: CHARACTERS, bots, seed: 42, eliminateOnFall: true });
const intents = (sim, patches = {}) => new Map(sim.fighters.map((fighter) => [fighter.id, { ...idle(), ...(patches[fighter.id] ?? {}) }]));
const advance = (sim, frames, patches = {}) => {
  for (let index = 0; index < frames; index++) sim.step(STEP, intents(sim, patches));
};

function center(sim) {
  for (const fighter of sim.fighters) fighter.pos = { x: 0, y: 0, z: 0 };
}

function pickup(sim, fighter, type) {
  const item = sim.spawnItem(type, { x: fighter.pos.x, z: fighter.pos.z, y: 0 });
  assert.ok(item);
  sim.step(STEP, intents(sim, { [fighter.id]: { grab: true } }));
  assert.equal(fighter.heldItem?.type, type);
  return item;
}

function use(sim, fighter, frames = 1) {
  sim.step(STEP, intents(sim, { [fighter.id]: { punch: true, punchHeld: true } }));
  if (frames > 1) advance(sim, frames - 1);
}

function setupDuel() {
  const sim = makeSim(['cat']);
  const [attacker, target] = sim.fighters;
  attacker.pos = { x: 0, y: 0, z: 0 };
  target.pos = { x: 0, y: 0, z: 1 };
  attacker.facing = 0;
  target.facing = Math.PI;
  return { sim, attacker, target };
}

test('空投在 6s/18s 各到 2 个，y14 落下、中心半径 2–6 且同屏最多 4', () => {
  const sim = makeSim();
  advance(sim, 359);
  assert.equal(sim.items.length, 0);
  sim.step(STEP, intents(sim));
  assert.equal(sim.items.length, 2);
  assert.equal(sim.events.filter((event) => event.type === 'itemSpawn').length, 2);
  for (const event of sim.events.filter((event) => event.type === 'itemSpawn')) {
    assert.equal(event.y, ITEM_RULES.spawnY);
    const radius = Math.hypot(event.x, event.z);
    assert.ok(radius >= 2 && radius <= 6);
  }
  assert.ok(sim.items.every((item) => item.state === 'falling' && item.pos.y < 14));
  advance(sim, 720);
  assert.equal(sim.items.length, 4);
  assert.equal(sim.events.filter((event) => event.type === 'itemSpawn').length, 2);
  advance(sim, 720);
  assert.ok(Math.abs(sim.time - 30) < 1e-9);
  assert.equal(sim.items.length, ITEM_RULES.maxItems);
  assert.equal(sim.events.filter((event) => event.type === 'itemSpawn').length, 0);
  sim.items.length = 0;
  advance(sim, 720);
  assert.equal(sim.items.length, 2, '腾出空间后下一轮仍按独立时刻表空投');
});

test('空投落地 0.6s 后可拾取；debug 落地物可立即拾取，持物 K 完全无效', () => {
  const sim = makeSim();
  const fighter = sim.fighters[0];
  center(sim);
  const dropped = sim.spawnItem('fish', { x: 0, z: 0, y: 14 });
  while (dropped.state !== 'grounded') sim.step(STEP, intents(sim));
  assert.ok(dropped.pickupT > 0.59);
  sim.step(STEP, intents(sim, { f0: { grab: true } }));
  assert.equal(fighter.heldItem, null);
  advance(sim, 40);
  sim.step(STEP, intents(sim, { f0: { grab: true } }));
  assert.deepEqual(fighter.heldItem, { type: 'fish', uses: 3 });
  assert.equal(sim.events.filter((event) => event.type === 'itemPickup').length, 1);
  sim.step(STEP, intents(sim, { f0: { grab: true } }));
  assert.deepEqual(fighter.heldItem, { type: 'fish', uses: 3 });
  assert.equal(fighter.attack, null);
  assert.equal(fighter.grabTarget, null);

  const manual = makeSim();
  center(manual);
  pickup(manual, manual.fighters[0], 'hammer');
});

test('鱼使用 3 次、锤使用 2 次后消失，itemUse 次数同步递减', () => {
  for (const [type, uses] of [['fish', 3], ['hammer', 2]]) {
    const sim = makeSim();
    const fighter = sim.fighters[0];
    center(sim);
    pickup(sim, fighter, type);
    const duration = MOVES[type].startup + MOVES[type].active + MOVES[type].recovery;
    for (let remaining = uses - 1; remaining >= 0; remaining--) {
      sim.step(STEP, intents(sim, { f0: { punch: true, punchHeld: true } }));
      const event = sim.events.find((entry) => entry.type === 'itemUse');
      assert.equal(event?.itemType, type);
      assert.equal(event?.uses, remaining);
      assert.equal(fighter.heldItem?.uses ?? null, remaining || null);
      advance(sim, Math.ceil(duration / STEP) + 2);
    }
    assert.equal(fighter.heldItem, null);
  }
});

test('鱼/锤复用攻击管线，范围、前摇、弧度、击飞与韧性符合配置', () => {
  assert.equal(MOVES.fish.startup < MOVES.hammer.startup, true);
  assert.deepEqual(
    [MOVES.fish.range, MOVES.fish.arc, MOVES.fish.knock, MOVES.fish.poise],
    [1.9, 120, 12, 20],
  );
  assert.deepEqual(
    [MOVES.hammer.startup, MOVES.hammer.range, MOVES.hammer.arc, MOVES.hammer.knock, MOVES.hammer.poise],
    [0.28, 2, 90, 26, 45],
  );

  for (const type of ['fish', 'hammer']) {
    const { sim, attacker, target } = setupDuel();
    target.pos.z = 1.8;
    pickup(sim, attacker, type);
    sim.step(STEP, intents(sim, { f0: { punch: true, punchHeld: true } }));
    let hit = null;
    let frames = 0;
    while (!hit && frames < 30) {
      sim.step(STEP, intents(sim));
      frames++;
      hit = sim.events.find((event) => event.type === 'hit' && event.target === target.id);
      if (type === 'hammer' && sim.time < 0.28 + 1e-9) assert.equal(hit, undefined);
    }
    assert.ok(hit, `${type} 应在普通拳距离外命中`);
    assert.equal(hit.move, type);
    assert.equal(target.poise, CONFIG.combat.poise - MOVES[type].poise);
    assert.ok(Math.hypot(target.vel.x, target.vel.z) > 0);
  }
});

test('炸弹 1.2s 爆炸，且同屏飞行炸弹最多 1', () => {
  const sim = makeSim();
  const fighter = sim.fighters[0];
  center(sim);
  pickup(sim, fighter, 'bomb');
  use(sim, fighter);
  assert.equal(fighter.heldItem, null);
  assert.equal(sim.bombs.length, 1);
  advance(sim, 70);
  assert.equal(sim.bombs.length, 1);
  assert.equal(sim.events.some((event) => event.type === 'explosion'), false);
  sim.step(STEP, intents(sim));
  assert.equal(sim.bombs.length, 0);
  assert.equal(sim.events.filter((event) => event.type === 'explosion').length, 1);

  const capped = makeSim();
  center(capped);
  const owner = capped.fighters[0];
  pickup(capped, owner, 'bomb');
  use(capped, owner);
  pickup(capped, owner, 'bomb');
  use(capped, owner);
  assert.equal(capped.bombs.length, 1);
  assert.deepEqual(owner.heldItem, { type: 'bomb', uses: 1 });
});

test('爆炸半径 3，范围外无伤，自炸吃 0.7 倍 knock/poise', () => {
  const sim = makeSim(['cat', 'rabbit']);
  const [owner, inside, outside] = sim.fighters;
  owner.pos = { x: 0, y: 0, z: 0 };
  inside.pos = { x: 0, y: 0, z: 2 };
  outside.pos = { x: 0, y: 0, z: 3.1 };
  owner.facing = 0;
  pickup(sim, owner, 'bomb');
  use(sim, owner);
  const bomb = sim.bombs[0];
  bomb.pos = { x: 0, y: 1, z: 0 };
  bomb.vel = { x: 0, y: 0, z: 0 };
  bomb.age = ITEMS.bomb.fuse;
  sim.step(STEP, intents(sim));
  assert.equal(sim.events.filter((event) => event.type === 'explosion').length, 1);
  assert.equal(owner.poise, CONFIG.combat.poise - MOVES.bomb.poise * 0.7);
  assert.equal(inside.poise, CONFIG.combat.poise - MOVES.bomb.poise);
  assert.equal(outside.poise, CONFIG.combat.poise);
  assert.ok(Math.hypot(owner.vel.x, owner.vel.z) > 0);
  assert.ok(Math.hypot(inside.vel.x, inside.vel.z) > Math.hypot(owner.vel.x, owner.vel.z));
  assert.equal(Math.hypot(outside.vel.x, outside.vel.z), 0);
});

function punchVelocity(withItem) {
  const { sim, attacker, target } = setupDuel();
  if (withItem) {
    pickup(sim, attacker, withItem);
    use(sim, attacker);
  }
  sim.step(STEP, intents(sim, { f0: { punch: true, punchHeld: true } }));
  for (let frame = 0; frame < 20; frame++) {
    sim.step(STEP, intents(sim));
    if (sim.events.some((event) => event.type === 'hit' && event.target === target.id)) break;
  }
  return Math.hypot(target.vel.x, target.vel.z);
}

test('拳套 30s 普通拳击飞 ×1.5，星出拳 ×1.3', () => {
  const base = punchVelocity(null);
  assert.ok(Math.abs(punchVelocity('glove') / base - 1.5) < 1e-9);
  assert.ok(Math.abs(punchVelocity('star') / base - 1.3) < 1e-9);
  const sim = makeSim();
  center(sim);
  const fighter = sim.fighters[0];
  pickup(sim, fighter, 'glove');
  use(sim, fighter);
  assert.equal(fighter.gloveT, 30);
  advance(sim, 1800);
  assert.equal(fighter.gloveT, 0);
});

test('星星提供 8s 无敌与 1.2 倍速度，结束帧准时失效', () => {
  const sim = makeSim();
  center(sim);
  const fighter = sim.fighters[0];
  pickup(sim, fighter, 'star');
  use(sim, fighter);
  assert.equal(fighter.starT, 8);
  assert.equal(fighter.invulnT, 8);
  advance(sim, 60, { f0: { mx: 1 } });
  assert.ok(Math.abs(Math.hypot(fighter.vel.x, fighter.vel.z) - CONFIG.physics.maxSpeed * 1.2) < 1e-9);
  advance(sim, 419);
  assert.ok(fighter.starT > 0);
  assert.ok(fighter.invulnT > 0);
  sim.step(STEP, intents(sim));
  assert.equal(fighter.starT, 0);
  assert.equal(fighter.invulnT, 0);

  const duel = setupDuel();
  pickup(duel.sim, duel.target, 'star');
  use(duel.sim, duel.target);
  duel.sim.step(STEP, intents(duel.sim, { f0: { punch: true, punchHeld: true } }));
  advance(duel.sim, 20);
  assert.equal(duel.target.poise, CONFIG.combat.poise);
});

test('星在 createSim 生命周期最多 1 个，reset 不恢复额度', () => {
  const sim = makeSim();
  assert.ok(sim.spawnItem('star', { x: 0, z: 0 }));
  assert.equal(sim.spawnItem('star', { x: 1, z: 0 }), null);
  sim.reset();
  assert.equal(sim.items.length, 0);
  assert.equal(sim.spawnItem('star', { x: 0, z: 0 }), null);
});

test('眩晕/击倒和淘汰会掉落手持物并保留剩余次数', () => {
  const { sim, attacker, target } = setupDuel();
  pickup(sim, target, 'hammer');
  pickup(sim, attacker, 'fish');
  target.poise = 1;
  use(sim, attacker);
  advance(sim, 12);
  assert.ok(target.dizzyT > 0 || target.tumbleT > 0);
  assert.equal(target.heldItem, null);
  assert.ok(sim.items.some((item) => item.type === 'hammer' && item.uses === 2));

  const eliminated = setupDuel();
  pickup(eliminated.sim, eliminated.target, 'glove');
  eliminated.target.pos.y = CONFIG.physics.fallY - 0.01;
  eliminated.target.onGround = false;
  eliminated.sim.step(STEP, intents(eliminated.sim));
  assert.equal(eliminated.target.eliminated, true);
  assert.equal(eliminated.target.heldItem, null);
  assert.ok(eliminated.sim.items.some((item) => item.type === 'glove'));
});
