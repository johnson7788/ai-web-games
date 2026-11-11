import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim } from '../src/game/sim.js';
import { createMatch } from '../src/game/match.js';
import { CLOUD_RING } from '../config/arenas.js';
import { CHARACTERS } from '../config/characters.js';
import { CONFIG, STEP } from '../config/game.config.js';

const noBrains = { update() {}, intentOf() { return null; }, reset() {} };
const idle = { mx: 0, mz: 0, jump: false, dash: false, punch: false, grab: false, charge: false };

function makeMatch() {
  const sim = createSim({ arena: CLOUD_RING, characters: CHARACTERS, bots: ['cat', 'rabbit'], seed: 5, eliminateOnFall: true });
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
  for (let i = 0; i < Math.ceil(CONFIG.match.roundEndTime / STEP) + 1; i++) match.step(STEP, idle);
}

test('intro 冻结输入并输出 3/2/1/GO 倒计时', () => {
  const { sim, match } = makeMatch();
  const events = [{ type: 'roundStart', round: 1 }, { type: 'countdown', value: 3, round: 1 }];
  for (let i = 0; i < Math.ceil(CONFIG.match.introTime / STEP); i++) {
    match.step(STEP, { ...idle, mx: 1 });
    events.push(...match.drainEvents());
  }
  assert.equal(sim.time, 0);
  assert.deepEqual(events.filter((event) => event.type === 'countdown').map((event) => event.value), [3, 2, 1, 'GO']);
  assert.equal(match.phase, 'fight');
});

test('三人三回合按 3/2/1 计分并产生总冠军', () => {
  const { sim, match } = makeMatch();
  for (let round = 0; round < 3; round++) {
    enterFight(match);
    eliminate(sim, match, 'f2');
    eliminate(sim, match, 'f1');
    assert.equal(match.phase, 'roundEnd');
    const result = match.roundResults.at(-1);
    assert.deepEqual(result.rankings, ['f0', 'f1', 'f2']);
    nextRound(match);
  }
  assert.equal(match.phase, 'matchEnd');
  const standings = match.standings;
  assert.deepEqual(standings.map((score) => [score.id, score.points]), [['f0', 9], ['f1', 6], ['f2', 3]]);
  assert.equal(match.winner.id, 'f0');
  assert.equal(match.winner.bestRank, 1);
});

test('总分和回合胜场平手时按 KO 数排名', () => {
  const { match } = makeMatch();
  for (const score of match.scores.values()) Object.assign(score, { points: 4, roundWins: 1, bestRank: 2, kos: 0 });
  match.scores.get('f1').kos = 2;
  match.scores.get('f2').kos = 1;
  assert.deepEqual(match.standings.map((score) => score.id), ['f1', 'f2', 'f0']);
});
