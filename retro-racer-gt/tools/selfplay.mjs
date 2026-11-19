// RETRO RACER GT · 自对弈（M1 拥有）
// Node 无头直接 import sim（无 DOM）。固定 seed 驱动 greedy / random / noinput 三策略，
// 写 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun } from '../src/game/sim.js';
import { PLAYER, LANE_X, TRAFFIC } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function makeTracker(run, policy, seed) {
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
    tick(dt) {
      run.step(dt);
      this.simTime += dt;
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'levelUp' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'crash') this.deaths += 1;
      }
    },
    act(fn) {
      const res = fn();
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
        this.tick(1 / 60);
      }
      return res;
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
    level: run.state.tier + 1,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.tier + 1,
    completed: false, // 无尽赛车无「通关」；以难度推进衡量
  };
}

// 车道安全度 = 该车道内所有接近物到玩家车的最小撞击时间（秒）；Infinity = 无威胁。
function laneSafety(run, lane) {
  const st = run.state;
  let minT = Infinity;
  for (const c of st.cars) {
    if (c.lane !== lane) continue;
    const worldVel = c.dir === 1 ? TRAFFIC.sameDirSpeed : -TRAFFIC.oncomingSpeed;
    const screenVel = st.speed - worldVel;
    if (screenVel <= 0 || c.y > PLAYER.Y + 30) continue; // 后退或已越过
    const t = (PLAYER.Y - c.y) / screenVel;
    if (t < minT) minT = t;
  }
  for (const r of st.rocks) {
    if (r.lane !== lane) continue;
    if (st.speed <= 0 || r.y > PLAYER.Y + 30) continue;
    const t = (PLAYER.Y - r.y) / st.speed;
    if (t >= 0 && t < minT) minT = t;
  }
  return minT;
}

const SAFE_SEC = 1.6;

// greedy：只在中车道 1/2 之间活动（避开对向快车道的陷阱），
// 一次只挪一格且只挪进更安全的相邻车道；安全时追中车道星 / 开氮气。
function decide(run) {
  const st = run.state;
  if (st.turnDir !== 0) return 'wait';
  const cur = st.lane;

  // 意外落入边车道：回到更安全的中车道
  if (cur === 0) {
    if (laneSafety(run, 1) >= laneSafety(run, 0)) return 'right';
    return (!st.nitroActive && st.nitroCd <= 0) ? 'nitro' : 'wait';
  }
  if (cur === 3) {
    if (laneSafety(run, 2) >= laneSafety(run, 3)) return 'left';
    return (!st.nitroActive && st.nitroCd <= 0) ? 'nitro' : 'wait';
  }

  const curSafe = laneSafety(run, cur);
  const other = cur === 1 ? 2 : 1;
  const otherSafe = laneSafety(run, other);

  if (curSafe < SAFE_SEC) {
    if (otherSafe > curSafe) return cur === 1 ? 'right' : 'left';
    if (!st.nitroActive && st.nitroCd <= 0) return 'nitro';
    return 'wait';
  }

  const star = st.stars.find(
    (s) => !s.collected && s.y < PLAYER.Y && s.y > PLAYER.Y - 500 &&
          (s.lane === 1 || s.lane === 2) && s.lane !== cur && laneSafety(run, s.lane) >= SAFE_SEC,
  );
  if (star) return star.lane > cur ? 'right' : 'left';
  if (!st.nitroActive && st.nitroCd <= 0) return 'nitro';
  return 'wait';
}

function greedyOnce(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'greedy', seed);
  const MAX_SEC = 90;
  while (run.state.phase === 'running' && tel.simTime < MAX_SEC) {
    const d = decide(run);
    if (d === 'left') tel.act(() => run.turnLeft());
    else if (d === 'right') tel.act(() => run.turnRight());
    else if (d === 'nitro') tel.act(() => run.useNitro());
    else tel.tick(1 / 60);
  }
  return finish(tel, run);
}

function randomOnce(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'random', seed);
  let x = seed * 7919 + 13;
  const rng = () => {
    x |= 0; x = (x + 0x6D2B79F5) | 0;
    let t = Math.imul(x ^ (x >>> 15), 1 | x);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const MAX_SEC = 40;
  while (run.state.phase === 'running' && tel.simTime < MAX_SEC) {
    const roll = rng();
    if (roll < 0.4) tel.act(() => run.turnLeft());
    else if (roll < 0.8) tel.act(() => run.turnRight());
    else if (roll < 0.92) tel.act(() => run.useNitro());
    else tel.tick(1 / 60);
  }
  return finish(tel, run);
}

function noinputOnce(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 30;
  while (run.state.phase === 'running' && tel.simTime < MAX_SEC) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [greedyOnce(3), randomOnce(2), noinputOnce(3)];
const payload = {
  game: 'retro-racer-gt',
  genre: 'racing',
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
    `actions=${r.actions} deaths=${r.deaths} level=${r.levelsReached} events=${r.uniqueEvents}`,
  );
}
