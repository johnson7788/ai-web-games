import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim } from '../src/game/sim.js';
import { createMatch } from '../src/game/match.js';
import { createBrains } from '../src/game/ai.js';
import { CLOUD_RING } from '../config/arenas.js';
import { MODES } from '../config/modes.js';
import { CHARACTERS } from '../config/characters.js';
import { CONFIG, STEP } from '../config/game.config.js';
import { calculateTeamCoins } from '../src/core/economy.js';

const noBrains = { update() {}, intentOf() { return null; }, reset() {} };
const idle = { mx: 0, mz: 0, jump: false, dash: false, punch: false, grab: false, charge: false };
const intents = (sim, player = idle) => new Map(sim.fighters.map((fighter) => [fighter.id, fighter.id === 'f0' ? player : idle]));

function makeTeamMatch() {
  const sim = createSim({ arena: CLOUD_RING, characters: CHARACTERS, bots: 7, teams: 2, seed: 5, eliminateOnFall: true });
  const match = createMatch({ sim, brains: noBrains });
  match.drainEvents();
  return { sim, match };
}

function enterFight(match) {
  match.skip();
  match.step(STEP, idle);
  assert.equal(match.phase, 'fight');
}

function eliminate(sim, match, id) {
  const fighter = sim.fighterMap.get(id);
  fighter.pos.y = CONFIG.physics.fallY - 0.01;
  fighter.onGround = false;
  match.step(STEP, idle);
}

function nextRound(match) {
  for (let frame = 0; frame < Math.ceil(CONFIG.match.roundEndTime / STEP) + 1; frame++) match.step(STEP, idle);
}

function eliminateTeam(sim, match, team) {
  for (const fighter of sim.fighters.filter((fighter) => fighter.team === team)) eliminate(sim, match, fighter.id);
}

test('模式配置与 4v4 交替分队，玩家固定红队', () => {
  assert.equal(MODES.ffa.players, 8);
  assert.equal(MODES.team.teamSize, 4);
  assert.equal(MODES.team.winRounds, 2);
  const { sim } = makeTeamMatch();
  assert.deepEqual(sim.fighters.map((fighter) => fighter.team), [0, 1, 0, 1, 0, 1, 0, 1]);
  assert.equal(sim.fighters[0].team, 0);
  assert.equal(sim.fighters.filter((fighter) => fighter.team === 0).length, 4);
  assert.equal(sim.fighters.filter((fighter) => fighter.team === 1).length, 4);
});

test('队友拳击与抓取无效，敌人正常受伤', () => {
  const { sim, match } = makeTeamMatch();
  const [attacker, enemy, teammate] = sim.fighters;
  attacker.pos = { x: 0, y: 0, z: 0 };
  teammate.pos = { x: 0, y: 0, z: 1 };
  enemy.pos = { x: 5, y: 0, z: 0 };
  attacker.facing = 0;
  sim.step(STEP, intents(sim, { ...idle, punch: true, punchHeld: true }));
  for (let frame = 0; frame < 50; frame++) sim.step(STEP, intents(sim));
  assert.equal(teammate.poise, CONFIG.combat.poise);
  assert.equal(teammate.lastHitBy, null);
  attacker.attack = null;
  attacker.action = null;
  attacker.pos = { x: 0, y: 0, z: 0 };
  teammate.pos = { x: 5, y: 0, z: 0 };
  enemy.pos = { x: 0, y: 0, z: 1 };
  sim.step(STEP, intents(sim, { ...idle, punch: true, punchHeld: true }));
  for (let frame = 0; frame < 20; frame++) sim.step(STEP, intents(sim));
  assert.ok(enemy.poise < CONFIG.combat.poise);
  attacker.attack = null;
  sim.step(STEP, intents(sim, { ...idle, grab: true }));
  for (let frame = 0; frame < 15; frame++) sim.step(STEP, intents(sim));
  assert.notEqual(attacker.grabTarget, teammate.id);
  assert.equal(match.phase, 'intro');
});

test('团队回合全灭计分并先到两回合结束', () => {
  const { sim, match } = makeTeamMatch();
  enterFight(match);
  eliminateTeam(sim, match, 1);
  assert.equal(match.phase, 'roundEnd');
  assert.equal(match.roundResults.at(-1).teamWinner, 0);
  assert.deepEqual(match.teamScores, [1, 0]);
  nextRound(match);
  enterFight(match);
  eliminateTeam(sim, match, 0);
  assert.deepEqual(match.teamScores, [1, 1]);
  nextRound(match);
  enterFight(match);
  eliminateTeam(sim, match, 1);
  assert.deepEqual(match.teamScores, [2, 1]);
  nextRound(match);
  assert.equal(match.phase, 'matchEnd');
  assert.equal(match.winningTeam, 0);
});

function timeoutResult(poiseByTeam = null) {
  const { sim, match } = makeTeamMatch();
  enterFight(match);
  if (poiseByTeam) {
    for (const fighter of sim.fighters) fighter.poise = poiseByTeam[fighter.team];
  }
  for (let frame = 0; frame < Math.ceil(CONFIG.match.roundTime / STEP) + 1 && match.phase === 'fight'; frame++) {
    for (const fighter of sim.alive) {
      const index = Number(fighter.id.slice(1));
      fighter.pos = { x: (index % 4 - 1.5) * 0.9, y: 0, z: fighter.team === 0 ? -0.3 : 0.3 };
      fighter.vel = { x: 0, y: 0, z: 0 };
      fighter.onGround = true;
    }
    match.step(STEP, idle);
  }
  return match.roundResults.at(-1);
}

test('75 秒同人数时按双方总 poise 判定回合胜者', () => {
  const result = timeoutResult([90, 40]);
  assert.equal(result.teamWinner, 0);
});

test('75 秒先比较存活人数，再比较 poise', () => {
  const { sim, match } = makeTeamMatch();
  enterFight(match);
  eliminate(sim, match, 'f1');
  eliminate(sim, match, 'f3');
  for (let frame = 0; frame < Math.ceil(CONFIG.match.roundTime / STEP) + 1 && match.phase === 'fight'; frame++) {
    for (const fighter of sim.alive) {
      fighter.pos = { x: 0, y: 0, z: 0 };
      fighter.vel = { x: 0, y: 0, z: 0 };
      fighter.onGround = true;
      fighter.poise = 1;
    }
    match.step(STEP, idle);
  }
  assert.equal(match.roundResults.at(-1).teamWinner, 0);
});

test('normal 前 15 秒最多一个 bot 锁定玩家', () => {
  const sim = createSim({ arena: CLOUD_RING, characters: CHARACTERS, bots: 7, seed: 19, eliminateOnFall: true });
  const brains = createBrains({ fighters: sim.fighters, characters: CHARACTERS, arena: CLOUD_RING, seed: 19, difficulty: 'normal' });
  for (let frame = 0; frame < 15 * 60; frame++) {
    sim.fighters[0].pos = { x: 0, y: 0, z: 0 };
    sim.fighters[0].vel = { x: 0, y: 0, z: 0 };
    brains.update(STEP, sim);
    sim.step(STEP, new Map(sim.fighters.map((fighter) => [fighter.id, brains.intentOf(fighter.id)])));
  }
  assert.ok(brains.maxPlayerTargets <= 1);
});

test('团队金币只按胜负和 KO 计算', () => {
  assert.deepEqual(calculateTeamCoins({ won: true, kos: 2 }), {
    total: 180,
    breakdown: { rank: 150, kos: 30, firstWin: 0, champion: 0 },
  });
  assert.deepEqual(calculateTeamCoins({ won: false, kos: 1 }), {
    total: 55,
    breakdown: { rank: 40, kos: 15, firstWin: 0, champion: 0 },
  });
});
