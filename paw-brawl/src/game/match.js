import { CONFIG, STEP } from '../../config/game.config.js';
import { MODES } from '../../config/modes.js';

export function createMatch({ sim, brains, playerId = 'f0', onResetRound = null }) {
  const M = CONFIG.match;
  const teamMode = sim.teams === 2;
  const rules = teamMode ? MODES.team : MODES.ffa;
  const events = [];
  const scores = new Map(sim.fighters.map((fighter) => [fighter.id, { id: fighter.id, team: fighter.team, points: 0, kos: 0, bestRank: 0, roundWins: 0 }]));
  const roundResults = [];
  const teamScores = [0, 0];
  let phase = 'intro';
  let phaseT = 0;
  let round = 1;
  let countdownIndex = 1;

  function emit(event) { events.push(event); }
  function beginIntro() {
    phase = 'intro';
    phaseT = 0;
    countdownIndex = 1;
    emit({ type: 'roundStart', round });
    emit({ type: 'countdown', value: 3, round });
  }
  beginIntro();

  function sortedStandings() {
    return [...scores.values()].sort((a, b) => {
      if (teamMode) {
        const scoreDelta = teamScores[b.team] - teamScores[a.team];
        if (scoreDelta) return scoreDelta;
      }
      return b.points - a.points || b.roundWins - a.roundWins || b.kos - a.kos ||
        (a.bestRank || 99) - (b.bestRank || 99) || a.id.localeCompare(b.id);
    });
  }

  function rankingsForRound() {
    const survivors = sim.alive.sort((a, b) => b.kos - a.kos || b.poise - a.poise ||
      Math.hypot(a.pos.x, a.pos.z) - Math.hypot(b.pos.x, b.pos.z) || a.id.localeCompare(b.id));
    return [...survivors.map((fighter) => fighter.id), ...[...sim.eliminationOrder].reverse()];
  }

  function teamRoundWinner() {
    const counts = [0, 0];
    const poise = [0, 0];
    for (const fighter of sim.alive) {
      counts[fighter.team] += 1;
      poise[fighter.team] += fighter.poise;
    }
    if (counts[0] !== counts[1]) return counts[0] > counts[1] ? 0 : 1;
    return poise[0] >= poise[1] ? 0 : 1;
  }

  function finishRound() {
    if (phase !== 'fight') return;
    const teamWinner = teamMode ? teamRoundWinner() : null;
    if (teamMode) teamScores[teamWinner] += 1;
    let rankings = rankingsForRound();
    if (teamMode) {
      rankings = [...sim.fighters].sort((a, b) =>
        Number(b.team === teamWinner) - Number(a.team === teamWinner) ||
        Number(a.eliminated) - Number(b.eliminated) || b.kos - a.kos || b.poise - a.poise || a.id.localeCompare(b.id),
      ).map((fighter) => fighter.id);
    }
    const roundPoints = {};
    const roundKos = {};
    rankings.forEach((id, index) => {
      const rank = index + 1;
      const fighter = sim.fighterMap.get(id);
      const score = scores.get(id);
      fighter.rank = rank;
      roundPoints[id] = teamMode ? Number(fighter.team === teamWinner) : M.points[index] ?? 0;
      roundKos[id] = fighter.kos;
      score.points = teamMode ? teamScores[fighter.team] : score.points + roundPoints[id];
      score.bestRank = score.bestRank === 0 ? rank : Math.min(score.bestRank, rank);
      if (teamMode ? fighter.team === teamWinner : rank === 1) score.roundWins += 1;
    });
    const result = {
      round, rankings, winner: rankings[0], roundPoints, roundKos,
      standings: sortedStandings().map((score) => ({ ...score })),
      ...(teamMode ? { teamWinner, teamScores: [...teamScores] } : {}),
    };
    roundResults.push(result);
    phase = 'roundEnd';
    phaseT = 0;
    emit({ type: 'roundEnd', ...result });
  }

  function step(dt, playerIntent = null) {
    if (Math.abs(dt - STEP) > 1e-9) throw new RangeError(`step expects dt=${STEP}`);
    if (phase === 'matchEnd') return match;
    phaseT += dt;
    if (phase === 'intro') {
      const interval = M.introTime / 4;
      const values = [3, 2, 1, 'GO'];
      while (countdownIndex < values.length && phaseT + 1e-9 >= interval * countdownIndex) {
        emit({ type: 'countdown', value: values[countdownIndex], round });
        countdownIndex += 1;
      }
      if (phaseT + 1e-9 >= M.introTime) {
        phase = 'fight';
        phaseT = 0;
        sim.phase = 'playing';
      }
      return match;
    }
    if (phase === 'roundEnd') {
      if (phaseT + 1e-9 >= M.roundEndTime) {
        const champion = teamMode && teamScores.some((score) => score >= rules.winRounds);
        if (round >= rules.rounds || champion) {
          phase = 'matchEnd';
          emit({
            type: 'matchEnd', standings: sortedStandings().map((score) => ({ ...score })), rounds: roundResults,
            ...(teamMode ? { teamWinner: teamScores[0] >= teamScores[1] ? 0 : 1, teamScores: [...teamScores] } : {}),
          });
        } else {
          round += 1;
          const replacement = onResetRound?.(round);
          if (replacement) {
            sim = replacement.sim;
            brains = replacement.brains;
          } else {
            sim.reset();
            brains.reset?.();
          }
          beginIntro();
        }
      }
      return match;
    }

    brains.update(dt, sim);
    const intents = new Map();
    for (const fighter of sim.fighters) {
      const botIntent = brains.intentOf(fighter.id);
      if (botIntent) intents.set(fighter.id, botIntent);
      else if (fighter.id === playerId && playerIntent) intents.set(fighter.id, playerIntent);
    }
    sim.step(dt, intents);
    for (const event of sim.events) {
      if (event.type === 'ko' && event.killer && scores.has(event.killer)) scores.get(event.killer).kos += 1;
      emit(event);
    }
    if (sim.roundEnded || sim.time + 1e-9 >= M.roundTime) finishRound();
    return match;
  }

  function skip() {
    if (phase === 'roundEnd') phaseT = M.roundEndTime;
    else if (phase === 'intro') phaseT = M.introTime;
  }

  function drainEvents() {
    return events.splice(0, events.length);
  }

  const match = {
    get sim() { return sim; },
    get brains() { return brains; },
    scores,
    teamScores,
    roundResults,
    step,
    skip,
    drainEvents,
    get phase() { return phase; },
    get phaseT() { return phaseT; },
    get round() { return round; },
    get timeLeft() { return Math.max(0, M.roundTime - sim.time); },
    get timeScale() { return phase === 'roundEnd' ? M.slowMotionScale : 1; },
    get standings() { return sortedStandings(); },
    get winner() { return phase === 'matchEnd' ? sortedStandings()[0] : null; },
    get winningTeam() { return teamMode && phase === 'matchEnd' ? (teamScores[0] >= teamScores[1] ? 0 : 1) : null; },
  };
  return match;
}
