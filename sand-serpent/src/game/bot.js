// 贪吃蛇 greedy 寻路（供 tools/selfplay.mjs 与 window.__ll.debug.autoPlay 共用）。
// 纯逻辑：BFS 最短路径追食物，避开墙/仙人掌/硬地与自身（尾巴若未增长可视为可走）。
import { dirName } from './sim.js';

const DIR_STEPS = [[-1, 0, 'up'], [1, 0, 'down'], [0, -1, 'left'], [0, 1, 'right']];
const DANGER = new Set(['wall', 'cactus', 'hard']);

export function greedyDir(run) {
  const s = run.state;
  const head = s.snake[0];
  const tail = s.snake[s.snake.length - 1];
  const wrap = run._level.wrap;

  const wrapCoord = (r, c) => {
    if (!wrap) return { r, c };
    if (r < 0) r = s.rows - 1; else if (r >= s.rows) r = 0;
    if (c < 0) c = s.cols - 1; else if (c >= s.cols) c = 0;
    return { r, c };
  };

  const snakeSet = new Set(s.snake.map((p) => `${p.r},${p.c}`));
  const blocked = (r, c) => {
    const cell = s.grid[r] && s.grid[r][c];
    if (!cell || DANGER.has(cell.kind)) return true;
    const k = `${r},${c}`;
    if (snakeSet.has(k) && !(tail.r === r && tail.c === c)) return true;
    return false;
  };

  const bfsDir = (target) => {
    const key = `${head.r},${head.c}`;
    const tkey = `${target.r},${target.c}`;
    if (key === tkey) return null;
    const visited = new Set([key]);
    const q = [[head.r, head.c, null]];
    let i = 0;
    while (i < q.length) {
      const [r, c, first] = q[i++];
      for (const [dr, dc, name] of DIR_STEPS) {
        const w = wrapCoord(r + dr, c + dc);
        const k = `${w.r},${w.c}`;
        if (visited.has(k)) continue;
        if (blocked(w.r, w.c)) continue;
        const f = first || name;
        if (k === tkey) return f;
        visited.add(k);
        q.push([w.r, w.c, f]);
      }
    }
    return null;
  };

  for (const f of s.food) {
    const d = bfsDir(f);
    if (d) return d;
  }

  const cur = run.dir;
  const left = { dr: -cur.dc, dc: cur.dr };
  const right = { dr: cur.dc, dc: -cur.dr };
  const rev = { dr: -cur.dr, dc: -cur.dc };
  for (const d of [cur, left, right, rev]) {
    const w = wrapCoord(head.r + d.dr, head.c + d.dc);
    if (!blocked(w.r, w.c)) return dirName(d);
  }
  return dirName(cur);
}
