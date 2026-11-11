import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim } from '../src/game/sim.js';
import { createBrains } from '../src/game/ai.js';
import { CLOUD_RING } from '../config/arenas.js';
import { CHARACTERS } from '../config/characters.js';
import { STEP } from '../config/game.config.js';

function selfplay(seed, frames = 3600) {
  const sim = createSim({ arena: CLOUD_RING, characters: CHARACTERS, bots: 7, seed, eliminateOnFall: true });
  sim.fighters[0].isPlayer = false;
  const brains = createBrains({ fighters: sim.fighters, characters: CHARACTERS, arena: CLOUD_RING, seed, allBots: true });
  let hits = 0;
  let suicides = 0;
  let maxOverlap = 0;
  const attackers = new Set();
  for (let i = 0; i < frames; i++) {
    brains.update(STEP, sim);
    sim.step(STEP, new Map(sim.fighters.map((fighter) => [fighter.id, brains.intentOf(fighter.id)])));
    for (const event of sim.events) {
      if (event.type === 'hit') {
        hits += 1;
        attackers.add(event.attacker);
      }
      if (event.type === 'ko' && !event.killer) suicides += 1;
    }
    for (let a = 0; a < sim.fighters.length; a++) {
      for (let b = a + 1; b < sim.fighters.length; b++) {
        const first = sim.fighters[a];
        const second = sim.fighters[b];
        if (first.eliminated || second.eliminated || first.state === 'falling' || second.state === 'falling' || first.grabbedBy || second.grabbedBy || Math.abs(first.pos.y - second.pos.y) > Math.max(first.height, second.height)) continue;
        const distance = Math.hypot(second.pos.x - first.pos.x, second.pos.z - first.pos.z);
        maxOverlap = Math.max(maxOverlap, first.radius + second.radius - distance);
      }
    }
  }
  return { sim, brains, hits, suicides, attackers, maxOverlap };
}

test('AI 60 秒无自杀、零碰撞穿透、命中至少 25 且不同角色都有输出', () => {
  const result = selfplay(1);
  assert.equal(result.suicides, 0);
  assert.ok(result.maxOverlap <= 1e-8, `maxOverlap=${result.maxOverlap}`);
  assert.ok(result.hits >= 25, `hits=${result.hits}`);
  assert.ok(result.attackers.size >= 4);
  assert.ok(result.brains.maxPlayerTargets <= 2);
});

test('同 seed 的 AI 与战斗跑 600 帧完全一致', () => {
  const run = () => {
    const sim = createSim({ arena: CLOUD_RING, characters: CHARACTERS, bots: 7, seed: 99, eliminateOnFall: true });
    const brains = createBrains({ fighters: sim.fighters, characters: CHARACTERS, arena: CLOUD_RING, seed: 99, allBots: true });
    for (let i = 0; i < 600; i++) {
      brains.update(STEP, sim);
      sim.step(STEP, new Map(sim.fighters.map((fighter) => [fighter.id, brains.intentOf(fighter.id)])));
    }
    return sim.fighters;
  };
  assert.deepEqual(run(), run());
});

test('8 人 60 秒模拟性能低于 1.5 秒', () => {
  const started = performance.now();
  selfplay(123);
  assert.ok(performance.now() - started < 1500);
});
