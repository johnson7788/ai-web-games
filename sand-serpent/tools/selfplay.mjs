// Sand Serpent · 自对弈
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 写完 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// greedy 串行打 L1→L2→L3（推进率门槛要求到达第 3 关）；random/noinput 在有墙的 L2 上跑，
// 保证至少两条 run 死过（deathPresence）。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32, dirName } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

const DIR_STEPS = [[-1, 0, 'up'], [1, 0, 'down'], [0, -1, 'left'], [0, 1, 'right']];
const DANGER = new Set(['wall', 'cactus', 'hard']);

function makeTracker(policy, seed) {
  return {
    id: policy,
    policy,
    seed,
    simTime: 0,
    firstInputAt: null,
    firstSuccessAt: null,
    deaths: 0,
    actions: 0,
    seen: new Set(),
    eventTimes: [0],
    maxLevel: 0,
    stepMove(run, countAction = true) {
      run.moveOnce();
      this.simTime += run.state.interval;
      if (countAction) this.actions += 1;
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'win' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'lose') this.deaths += 1;
      }
    },
  };
}

function finish(tel, run) {
  const times = tel.eventTimes.slice().sort((a, b) => a - b);
  let maxGap = 0;
  let idleSec = 0;
  for (let i = 1; i < times.length; i += 1) {
    const gap = times[i] - times[i - 1];
    if (gap > maxGap) maxGap = gap;
    if (gap > 3) idleSec += gap - 3;
  }
  return {
    id: tel.id,
    policy: tel.policy,
    seed: tel.seed,
    level: run.state.level,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: tel.maxLevel,
    completed: run.state.phase === 'won',
  };
}

// ---------------- greedy：BFS 最短路径追食物 ----------------
function chooseDir(run) {
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

  // 兜底：选一个安全邻格
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

function greedy() {
  const tel = makeTracker('greedy', 3);
  let run = null;
  for (const levelIndex of [0, 1, 2]) {
    run = createRun(levelIndex, { seed: 3 + levelIndex });
    tel.maxLevel = Math.max(tel.maxLevel, levelIndex + 1);
    let moves = 0;
    while (run.state.phase === 'playing' && moves < 1500) {
      const dir = chooseDir(run);
      run.input(dir);
      tel.stepMove(run, true);
      moves += 1;
    }
    if (run.state.phase !== 'won') break;
  }
  return finish(tel, run);
}

// ---------------- random：乱按，验证输入鲁棒与死亡 ----------------
function random() {
  const tel = makeTracker('random', 2);
  const run = createRun(1, { seed: 2 }); // L2 有墙
  const rng = mulberry32(2 * 7919 + 13);
  const NAMES = ['up', 'down', 'left', 'right'];
  let moves = 0;
  tel.maxLevel = 2;
  while (run.state.phase === 'playing' && moves < 900) {
    const dir = NAMES[Math.floor(rng() * NAMES.length)];
    run.input(dir);
    tel.stepMove(run, true);
    moves += 1;
  }
  return finish(tel, run);
}

// ---------------- noinput：什么都不做，测自动推进/死亡基线 ----------------
function noinput() {
  const tel = makeTracker('noinput', 3);
  const run = createRun(1, { seed: 3 }); // L2 有墙，直线前进撞墙
  let moves = 0;
  tel.maxLevel = 2;
  while (run.state.phase === 'playing' && moves < 200) {
    tel.stepMove(run, false);
    moves += 1;
  }
  return finish(tel, run);
}

const runs = [greedy(), random(), noinput()];
const payload = {
  game: 'sand-serpent',
  genre: 'arcade',
  source: 'bot',
  version: 'm1',
  runs,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${OUT} (${runs.length} runs)`);
for (const r of runs) {
  console.log(
    `${r.id.padEnd(8)} policy=${r.policy.padEnd(8)} dur=${r.durationSec}s ` +
    `firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} ` +
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed}`,
  );
}
