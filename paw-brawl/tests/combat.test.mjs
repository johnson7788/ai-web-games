import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim } from '../src/game/sim.js';
import { CONFIG, STEP } from '../config/game.config.js';
import { CLOUD_RING } from '../config/arenas.js';
import { CHARACTERS } from '../config/characters.js';
import { MOVES } from '../config/moves.js';

const idle = () => ({ mx: 0, mz: 0, jump: false, dash: false, punch: false, punchHeld: false, grab: false, charge: false });
const makeSim = (bots = ['cat']) => createSim({ arena: CLOUD_RING, characters: CHARACTERS, bots, seed: 42, eliminateOnFall: true });
const intents = (sim, player = idle()) => new Map(sim.fighters.map((fighter) => [fighter.id, fighter.id === 'f0' ? player : idle()]));
const advance = (sim, frames, player = idle()) => {
  for (let i = 0; i < frames; i++) sim.step(STEP, intents(sim, player));
};
const faceTarget = (attacker, target) => { attacker.facing = Math.atan2(target.pos.x - attacker.pos.x, target.pos.z - attacker.pos.z); };

function setupDuel(targetChar = 'cat') {
  const sim = makeSim([targetChar]);
  const [attacker, target] = sim.fighters;
  attacker.pos = { x: 0, y: 0, z: 0 };
  target.pos = { x: 0, y: 0, z: 1 };
  attacker.facing = 0;
  return { sim, attacker, target };
}

test('M6.6 攻击、抓取与炮弹距离配置', () => {
  assert.deepEqual([
    MOVES.punch1.range,
    MOVES.punch2.range,
    MOVES.punch3.range,
    MOVES.charged.range,
    MOVES.dashPunch.range,
    MOVES.slam.range,
    MOVES.grab.range,
    CONFIG.combat.grabDistance,
    CONFIG.combat.projectileRange,
    CONFIG.combat.frogGrabRange,
  ], [1.7, 1.7, 1.85, 2, 1.9, 3, 1.85, 1.55, 1.3, 1.4]);
});

test('拳在范围内只命中一次，范围外不命中', () => {
  const { sim, attacker, target } = setupDuel();
  sim.step(STEP, intents(sim, { ...idle(), punch: true, punchHeld: true }));
  advance(sim, 50);
  assert.equal(target.poise, CONFIG.combat.poise - 14);
  assert.equal(sim.events.filter((event) => event.type === 'hit').length, 0);
  attacker.pos = { x: 0, y: 0, z: 0 };
  target.pos = { x: 0, y: 0, z: 3 };
  target.poise = CONFIG.combat.poise;
  sim.step(STEP, intents(sim, { ...idle(), punch: true, punchHeld: true }));
  let hits = 0;
  for (let i = 0; i < 50; i++) {
    sim.step(STEP, intents(sim));
    hits += sim.events.filter((event) => event.type === 'hit').length;
  }
  assert.equal(hits, 0);
});

test('连招窗口内 1→2→3，超时回 1', () => {
  const { sim, attacker } = setupDuel();
  const moves = [];
  sim.step(STEP, intents(sim, { ...idle(), punch: true, punchHeld: true }));
  for (const event of sim.events) if (event.type === 'attack') moves.push(event.move);
  for (let i = 0; i < 150 && moves.length < 3; i++) {
    const queue = attacker.attack?.phase === 'recovery' && !attacker.queuedPunch;
    sim.step(STEP, intents(sim, queue ? { ...idle(), punch: true, punchHeld: true } : idle()));
    for (const event of sim.events) if (event.type === 'attack') moves.push(event.move);
  }
  assert.deepEqual(moves.slice(0, 3), ['punch1', 'punch2', 'punch3']);
  advance(sim, 60);
  sim.step(STEP, intents(sim, { ...idle(), punch: true, punchHeld: true }));
  assert.equal(attacker.attack.move, 'punch1');
});

test('同力量击飞兔子的位移显著大于熊猫', () => {
  const measure = (charId) => {
    const { sim, target } = setupDuel(charId);
    sim.step(STEP, intents(sim, { ...idle(), punch: true, punchHeld: true }));
    advance(sim, 16);
    return Math.hypot(target.pos.x, target.pos.z - 1);
  };
  const rabbit = measure('rabbit');
  const panda = measure('panda');
  assert.ok(rabbit > panda * 1.4, { rabbit, panda });
});

test('韧性打空眩晕，结束后恢复满韧性', () => {
  const { sim, target } = setupDuel();
  target.poise = 1;
  sim.step(STEP, intents(sim, { ...idle(), punch: true, punchHeld: true }));
  advance(sim, 12);
  assert.ok(target.dizzyT > 0);
  advance(sim, Math.ceil(CONFIG.combat.dizzyTime / STEP) + 2);
  assert.equal(target.dizzyT, 0);
  assert.equal(target.poise, CONFIG.combat.poise);
});

test('抓取锁定跟随，六次挣扎挣脱并短暂无敌', () => {
  const { sim, attacker, target } = setupDuel();
  sim.step(STEP, intents(sim, { ...idle(), grab: true }));
  advance(sim, 12);
  assert.equal(attacker.grabTarget, target.id);
  advance(sim, 20, { ...idle(), mx: 1 });
  assert.ok(Math.hypot(target.pos.x - attacker.pos.x, target.pos.z - attacker.pos.z) <= CONFIG.combat.grabDistance + 1e-9);
  for (let i = 0; i < CONFIG.combat.grabStruggles; i++) {
    sim.step(STEP, new Map([['f0', idle()], ['f1', { ...idle(), punch: true }]]));
    sim.step(STEP, intents(sim));
  }
  assert.equal(target.grabbedBy, null);
  assert.equal(attacker.grabTarget, null);
  assert.ok(target.invulnT > 0);
});

test('扔出速度达标，炮弹撞第三人双方受损', () => {
  const sim = makeSim(['cat', 'rabbit']);
  const [attacker, target, third] = sim.fighters;
  attacker.pos = { x: 0, y: 0, z: 0 };
  target.pos = { x: 0, y: 0, z: 1 };
  third.pos = { x: 0, y: 0, z: 3.2 };
  attacker.facing = 0;
  sim.step(STEP, intents(sim, { ...idle(), grab: true }));
  advance(sim, 12);
  assert.equal(attacker.grabTarget, target.id);
  sim.step(STEP, intents(sim, { ...idle(), punch: true, punchHeld: true }));
  let thrown = false;
  for (let i = 0; i < 30; i++) {
    sim.step(STEP, intents(sim));
    if (sim.events.some((event) => event.type === 'throw')) {
      thrown = true;
      assert.ok(Math.hypot(target.vel.x, target.vel.z) >= 10);
    }
  }
  assert.ok(thrown);
  assert.ok(target.poise < CONFIG.combat.poise);
  assert.ok(third.poise < CONFIG.combat.poise);
});

test('M6 轻重击顿帧与受击闪白时长', () => {
  assert.equal(CONFIG.combat.hitstopLight, 0.06);
  assert.equal(CONFIG.combat.hitstopHeavy, 0.10);
  assert.equal(CONFIG.combat.hitFlashTime, 0.09);
});

test('淘汰名次与 KO 归属最后命中者', () => {
  const { sim, attacker, target } = setupDuel();
  target.lastHitBy = attacker.id;
  target.pos.y = CONFIG.physics.fallY - 0.01;
  target.onGround = false;
  sim.step(STEP, intents(sim));
  assert.equal(target.eliminated, true);
  assert.equal(target.rank, 2);
  const ko = sim.events.find((event) => event.type === 'ko');
  assert.equal(ko.killer, attacker.id);
  assert.equal(attacker.kos, 1);
});

test('缩圈在 28 秒后开始并单调缩到 5.4', () => {
  const sim = makeSim();
  for (const fighter of sim.fighters) fighter.pos = { x: fighter.id === 'f0' ? -0.5 : 0.5, y: 0, z: 0 };
  const radii = [];
  for (let i = 0; i < 66 * 60; i++) {
    sim.step(STEP, intents(sim));
    if (i % 60 === 0) radii.push(sim.arenaRadius);
  }
  assert.equal(radii[27], CLOUD_RING.radius);
  assert.ok(radii[29] < CLOUD_RING.radius);
  assert.ok(radii.every((radius, index) => index === 0 || radius <= radii[index - 1]));
  assert.equal(sim.arenaRadius, CONFIG.match.minRadius);
});

test('狐冲刺冷却、蛙抓取距离、鸭落地硬直被动生效', () => {
  const fox = makeSim(['fox']);
  const foxFighter = fox.fighters[1];
  foxFighter.pos = { x: 0, y: 0, z: 0 };
  fox.step(STEP, new Map([['f0', idle()], ['f1', { ...idle(), mx: 1, dash: true }]]));
  assert.equal(foxFighter.dashCd, CONFIG.physics.dashCooldown * CONFIG.combat.foxDashCooldown);

  const frogSim = makeSim(['frog']);
  const [target, frog] = frogSim.fighters;
  target.pos = { x: 0, y: 0, z: 0 };
  frog.pos = { x: 0, y: 0, z: 2.9 };
  faceTarget(frog, target);
  frogSim.step(STEP, new Map([['f0', idle()], ['f1', { ...idle(), grab: true }]]));
  for (let i = 0; i < 12; i++) frogSim.step(STEP, new Map([['f0', idle()], ['f1', idle()]]));
  assert.equal(frog.grabTarget, target.id);

  const duckSim = makeSim(['duck']);
  const duck = duckSim.fighters[1];
  duck.pos = { x: 0, y: 0.1, z: 0 };
  duck.onGround = false;
  duck.tumbleT = 0.8;
  duckSim.step(STEP, new Map([['f0', idle()], ['f1', idle()]]));
  assert.equal(duck.landT, 0);
  assert.equal(duck.getUpT, 0);
});
