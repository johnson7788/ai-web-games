import { LEVELS } from '../config/levels.js';
import { createRun } from '../src/game/sim.js';
import { findSolution } from '../src/game/level.js';

for (const lv of LEVELS) {
  const idx = lv.index - 1;
  // quiescence: no pulls, step 20 ticks, beads shouldn't move and phase stays playing
  const q = createRun(idx, { seed: 1 });
  let qMoves = 0;
  for (let i = 0; i < 20 && q.state.phase === 'playing'; i += 1) {
    const before = q.state.beads.filter((b) => !b.done).map((b) => `${b.r},${b.c}`).sort().join('|');
    q.tick();
    const after = q.state.beads.filter((b) => !b.done).map((b) => `${b.r},${b.c}`).sort().join('|');
    if (before !== after) qMoves += 1;
  }
  const sol = findSolution(idx);
  const ok = sol !== null;
  console.log(`L${lv.index}: solvable=${ok} par=${lv.par} solution=[${sol}] quiescent=${qMoves === 0 && q.state.phase === 'playing'} (moves=${qMoves}, phase=${q.state.phase}, gates=${lv.gates.length}, beads=${lv.beads.length})`);
}
