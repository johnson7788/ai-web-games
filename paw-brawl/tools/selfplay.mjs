import { createSim } from '../src/game/sim.js';
import { createBrains } from '../src/game/ai.js';
import { createMatch } from '../src/game/match.js';
import { CHARACTERS, CHARACTER_MAP } from '../config/characters.js';
import { ARENA_MAP, CLOUD_RING } from '../config/arenas.js';
import { MODES } from '../config/modes.js';
import { STEP } from '../config/game.config.js';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const matchCount = Math.max(1, Number(option('rounds', 30)) | 0);
const baseSeed = Number(option('seed', 4)) | 0;
const difficulty = option('difficulty', 'normal');
const mode = option('mode', 'ffa');
const arena = ARENA_MAP[option('arena', 'cloud-ring')] ?? CLOUD_RING;
if (!MODES[mode]) throw new Error(`Unknown mode: ${mode}`);
const wins = new Map(CHARACTERS.map((character) => [character.id, 0]));
const rounds = [];
let totalHits = 0;
let hazardHits = 0;
let hazardKos = 0;
let selfDeaths = 0;
let maxPlayerTargets = 0;
let maxSteps = 0;
let playerSurvivalTotal = 0;
const teamWins = [0, 0];
const teamMatchWins = [0, 0];
const started = performance.now();

for (let index = 0; index < matchCount; index++) {
  const seed = baseSeed + index * 101;
  const offset = (index * 3) % CHARACTERS.length;
  const roster = CHARACTERS.map((_, rosterIndex) => CHARACTERS[(rosterIndex + offset) % CHARACTERS.length]);
  if (mode === 'team' && index % 2 === 1) {
    for (let rosterIndex = 0; rosterIndex < roster.length; rosterIndex += 2) [roster[rosterIndex], roster[rosterIndex + 1]] = [roster[rosterIndex + 1], roster[rosterIndex]];
  }
  const playerKnockScale = mode === 'team' ? 1 : difficulty === 'normal' ? 0.65 : difficulty === 'easy' ? 0.5 : 1;
  const sim = createSim({ arena, characters: CHARACTERS, playerCharId: roster[0].id, bots: roster.slice(1).map((character) => character.id), seed, eliminateOnFall: true, teams: MODES[mode].teams, playerKnockScale });
  if (mode === 'team') {
    sim.fighters[0].isPlayer = false;
    if (index % 2 === 1) for (const fighter of sim.fighters) fighter.team = 1 - fighter.team;
  }
  const brains = createBrains({ fighters: sim.fighters, characters: CHARACTERS, arena, seed: seed ^ 0x9e3779b9, difficulty, allBots: true });
  const match = createMatch({ sim, brains });
  let steps = 0;
  let playerDeathTime = null;
  while (match.phase !== 'matchEnd' && steps < 20000) {
    match.step(STEP);
    steps += 1;
    for (const event of match.drainEvents()) {
      if (event.type === 'hit') totalHits += 1;
      if (event.type === 'hazardHit') hazardHits += 1;
      if (event.type === 'ko' && event.killer?.startsWith('sweeper')) hazardKos += 1;
      if (event.type === 'ko' && !event.killer) selfDeaths += 1;
      if (event.type === 'ko' && event.victim === 'f0') playerDeathTime = sim.time;
      if (event.type === 'matchEnd' && event.teamWinner !== undefined) teamMatchWins[event.teamWinner] += 1;
      if (event.type === 'roundEnd') {
        const winner = sim.fighterMap.get(event.winner);
        wins.set(winner.charId, wins.get(winner.charId) + 1);
        if (event.teamWinner !== undefined) teamWins[event.teamWinner] += 1;
        playerSurvivalTotal += playerDeathTime ?? sim.time;
        playerDeathTime = null;
        rounds.push({ match: index + 1, round: event.round, winner: winner.charId, ...(event.teamWinner !== undefined ? { teamWinner: event.teamWinner, teamScores: event.teamScores } : {}), duration: Number(sim.time.toFixed(2)) });
      }
    }
  }
  if (steps >= 20000) throw new Error(`Match ${index + 1} did not finish`);
  maxSteps = Math.max(maxSteps, steps);
  maxPlayerTargets = Math.max(maxPlayerTargets, brains.maxPlayerTargets);
}

const winRates = Object.fromEntries(CHARACTERS.map((character) => {
  const count = wins.get(character.id);
  return [character.id, { wins: count, rate: Number((count / rounds.length * 100).toFixed(1)) }];
}));
const rates = Object.values(winRates).map((entry) => entry.rate);
const report = {
  matches: matchCount,
  rounds: rounds.length,
  mode,
  arena: arena.id,
  difficulty,
  teamWins,
  teamMatchWins,
  roundWinners: rounds,
  characterWinRates: winRates,
  averageRoundDuration: Number((rounds.reduce((sum, round) => sum + round.duration, 0) / rounds.length).toFixed(2)),
  totalHits,
  hazardHits,
  hazardKos,
  selfDeaths,
  maxPlayerTargets,
  averagePlayerSurvival: Number((playerSurvivalTotal / rounds.length).toFixed(2)),
  elapsedMs: Number((performance.now() - started).toFixed(1)),
  maxSteps,
  balanced: Math.min(...rates) >= 8 && Math.max(...rates) <= 35,
};
console.log(JSON.stringify(report, null, 2));
if (selfDeaths > 0 || totalHits === 0) process.exitCode = 1;
