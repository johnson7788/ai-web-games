// src/game/ai.js — 纯逻辑贪心 AI（供 tools/selfplay.mjs 与浏览器 debug.fastForward 复用）。
// 策略：候选四方向中排除掉头/越界/撞岩/咬身，选「可达空间最大、距目标最近」的方向。
// 冲刺：目标较远且能量充足时开启，靠近时关闭。
import { WORLD, SNAKE } from '../../config/game.config.js';

export function isSafeNext(run, x, y) {
  if (x < 0 || y < 0 || x >= WORLD.COLS || y >= WORLD.ROWS) return false;
  if (run.rocks.some((r) => r.x === x && r.y === y)) return false;
  // 不吃时尾巴会挪走，尾巴格安全；这里保守起见也把尾巴视为可走（食物永不刷在蛇身上）。
  const limit = run.snake.length - 1;
  for (let i = 0; i < limit; i += 1) {
    if (run.snake[i].x === x && run.snake[i].y === y) return false;
  }
  return true;
}

// 可达空间（BFS，蛇身全段视为墙，含尾巴；上界封顶）。
export function floodFill(run, sx, sy, cap = 400) {
  if (!isSafeNext(run, sx, sy)) return 0;
  const seen = new Set([`${sx},${sy}`]);
  const q = [[sx, sy]];
  let count = 0;
  const blocked = new Set(run.rocks.map((r) => `${r.x},${r.y}`));
  for (let i = 0; i < run.snake.length; i += 1) blocked.add(`${run.snake[i].x},${run.snake[i].y}`);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (q.length && count < cap) {
    const [x, y] = q.shift();
    count += 1;
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= WORLD.COLS || ny >= WORLD.ROWS) continue;
      const k = `${nx},${ny}`;
      if (seen.has(k) || blocked.has(k)) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return count;
}

export function greedyDir(run) {
  const head = run.snake[0];
  const rev = { x: -run.dir.x, y: -run.dir.y };
  const target = run.gold || run.food;
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];
  let best = null;
  let bestScore = -Infinity;
  for (const d of dirs) {
    if (d.x === rev.x && d.y === rev.y) continue;
    const nx = head.x + d.x;
    const ny = head.y + d.y;
    if (!isSafeNext(run, nx, ny)) continue;
    const freedom = floodFill(run, nx, ny);
    const dist = target ? Math.abs(nx - target.x) + Math.abs(ny - target.y) : 0;
    const score = freedom * 1000 - dist;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  if (!best) {
    for (const d of dirs) {
      const nx = head.x + d.x;
      const ny = head.y + d.y;
      if (isSafeNext(run, nx, ny)) { best = d; break; }
    }
  }
  return best || rev;
}

export function greedyBoost(run) {
  if (run.stage < 1) return false;
  if (run.energy < 25) return false;
  const target = run.gold || run.food;
  if (!target) return false;
  const head = run.snake[0];
  const dist = Math.abs(head.x - target.x) + Math.abs(head.y - target.y);
  return dist >= 6 && run.energy > SNAKE.ENERGY_MAX * 0.5;
}
