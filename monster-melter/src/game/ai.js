// MONSTER MELTER · 贪心 bot（供 tools/selfplay.mjs 与验收 debug 共用）
// 评分：优先一步成线，其次填接近满线的格子。
import { LINES } from './sim.js';

export function greedyMove(run) {
  const st = run.state;
  let best = null;
  for (let ti = 0; ti < 3; ti += 1) {
    const tray = st.trays[ti];
    if (!tray) continue;
    for (let a = 0; a < 61; a += 1) {
      if (!run.canPlace(ti, a)) continue;
      const targets = run.resolveTargets(a, tray.shape);
      const tset = new Set(targets);
      let clears = 0;
      let fill = targets.length;
      for (const line of LINES) {
        let filled = 0;
        for (const i of line) if (st.board[i].kind === 'gem') filled += 1;
        let add = 0;
        for (const i of line) if (tset.has(i)) add += 1;
        const tot = filled + add;
        if (tot === line.length) clears += 1;
        else if (tot >= Math.ceil(line.length * 0.6)) fill += add * 0.6;
      }
      const score = clears * 1000 + fill;
      if (!best || score > best.score) best = { ti, a, score };
    }
  }
  return best ? { ti: best.ti, a: best.a } : null;
}
