// SPIN PINGPONG · 自对弈（无头，直接 import sim）
// 用固定 seed 驱动 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json
// （schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { GAME } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function makeTracker(policy, seed) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    simTime: 0,
    firstInputAt: null,
    firstSuccessAt: null,
    deaths: 0,
    actions: 0,
    seen: new Set(),
    eventTimes: [0],
  };
}

function record(tel, run) {
  for (const e of run.drainEvents()) {
    tel.seen.add(e.type);
    tel.eventTimes.push(tel.simTime);
    if (e.type === 'win' && tel.firstSuccessAt === null) tel.firstSuccessAt = tel.simTime;
    if (e.type === 'lose') tel.deaths += 1;
  }
}

function tick(tel, run, dt) {
  run.step(dt);
  tel.simTime += dt;
  record(tel, run);
}

function act(tel, run, fn) {
  const res = fn();
  if (res && res.ok) {
    tel.actions += 1;
    if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
    tick(tel, run, 1 / 60);
  }
  return res;
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
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.level,
    completed: run.state.phase === 'won',
  };
}

// ---------------- greedy：串行打通 L1→L2→L3（记忆窗口后直接猜正确出口） ----------------
function playGreedy(run, tel) {
  const MAX_STEPS = 90 * 60;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (run.state.phase === 'won' || run.state.phase === 'lost') return run.state.phase === 'won';
    if (run.state.phase === 'predict') {
      act(tel, run, () => run.predict(run.state.end.x, run.state.end.y));
    } else {
      tick(tel, run, 1 / 60);
    }
  }
  return false;
}

function greedy(seed) {
  const tel = makeTracker('greedy', seed);
  let combo = 0;
  let run = null;
  let completed = true;
  for (const lv of [0, 1, 2]) {
    run = createRun(lv, { seed: seed + lv, combo });
    if (playGreedy(run, tel)) combo = run.state.combo;
    else { completed = false; break; }
  }
  return finish(tel, run);
}

// ---------------- random：乱按（狂点窥视 + 随机猜门），验证输入鲁棒 ----------------
function collectGates(run) {
  const gates = [];
  const s = run.state;
  for (let x = 0; x < s.size; x += 1) {
    for (let y = 0; y < s.size; y += 1) {
      if (s.grid[x][y].kind === 'gate' && !s.grid[x][y].start) gates.push({ x, y });
    }
  }
  return gates;
}

function random(seed) {
  const run = createRun(0, { seed: seed * 7919 + 13 });
  const tel = makeTracker('random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = LEVELS[0].duration + GAME.COUNTDOWN + LEVELS[0].memorizeSec + 6;
  const PEEK_TARGET = 20; // 乱按：狂点窥视，验证输入被持续接受
  let peeks = 0;
  while (run.state.phase !== 'won' && run.state.phase !== 'lost' && tel.simTime < MAX_SEC) {
    if (run.state.phase === 'predict') {
      if (peeks < PEEK_TARGET) {
        act(tel, run, () => run.peek());
        peeks += 1;
      } else {
        const gates = collectGates(run);
        const g = gates[Math.floor(rng() * gates.length)];
        act(tel, run, () => run.predict(g.x, g.y));
      }
    } else {
      tick(tel, run, 1 / 60);
    }
  }
  while (run.state.phase !== 'won' && run.state.phase !== 'lost' && tel.simTime < MAX_SEC + 5) {
    tick(tel, run, 1 / 60);
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测超时死亡基线 ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker('noinput', seed);
  const MAX_SEC = LEVELS[0].duration + GAME.COUNTDOWN + LEVELS[0].memorizeSec + 6;
  while (run.state.phase !== 'won' && run.state.phase !== 'lost' && tel.simTime < MAX_SEC) {
    tick(tel, run, 1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'spin-pingpong',
  genre: 'puzzle',
  source: 'bot',
  version: 'm1',
  runs,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${OUT} (${runs.length} runs)`);
for (const r of runs) {
  console.log(
    `${r.id.padEnd(10)} policy=${r.policy.padEnd(8)} dur=${r.durationSec}s ` +
    `firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} ` +
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed}`,
  );
}
