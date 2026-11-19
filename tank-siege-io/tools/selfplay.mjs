// tank-siege-io · 自对弈（无头，直接 import sim，零 DOM）
// 三策略：greedy（追最近敌人 + 对齐射击）/ random（乱按）/ noinput（只推进时间）
// 产出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
import { createRun, mulberry32 } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const DT = 1 / 60;

// ---------- 遥测 tracker ----------
function makeTracker(id, policy, seed) {
  return {
    id,
    policy,
    seed,
    simTime: 0,
    firstInputAt: null,
    firstSuccessAt: null,
    deaths: 0,
    actions: 0,
    seen: new Set(),
    eventTimes: [0],
    maxLevel: 1,
  };
}

function record(tel, run, dt) {
  tel.simTime += dt;
  for (const e of run.drainEvents()) {
    tel.seen.add(e.type);
    tel.eventTimes.push(tel.simTime);
    if (e.type === 'win' && tel.firstSuccessAt === null) tel.firstSuccessAt = tel.simTime;
    if (e.type === 'lose') tel.deaths += 1;
  }
  if (run.state.level > tel.maxLevel) tel.maxLevel = run.state.level;
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
    level: tel.maxLevel,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: tel.maxLevel,
    completed: tel.maxLevel >= 3,
  };
}

// ---------- greedy：追最近敌人，持续开火（像真人按住开火键） ----------
function greedyBot(r) {
  const st = r.state;
  const pl = st.player;
  if (!pl || !pl.alive) return;
  const enemies = st.tanks.filter((e) => e.team === 1 && e.alive);
  let dir = pl.dir;
  if (enemies.length) {
    let best = enemies[0];
    let bd = Infinity;
    for (const e of enemies) {
      const d = Math.abs(e.c - pl.c) + Math.abs(e.r - pl.r);
      if (d < bd) { bd = d; best = e; }
    }
    if (best.c === pl.c) dir = best.r < pl.r ? 0 : 2;
    else if (best.r === pl.r) dir = best.c < pl.c ? 3 : 1;
    else {
      const dc = best.c - pl.c;
      const dr = best.r - pl.r;
      dir = Math.abs(dc) >= Math.abs(dr) ? (dc > 0 ? 1 : 3) : (dr > 0 ? 2 : 0);
    }
  }
  if (r.setMove(dir).ok) tel.actions += 1;
  if (r.fire().ok) tel.actions += 1; // 持续开火
}

let tel = null;

function greedy(seed) {
  const r = createRun(seed);
  tel = makeTracker('greedy-1', 'greedy', seed);
  const MAX_SEC = 120;
  while (r.state.phase === 'playing' && tel.simTime < MAX_SEC && r.state.level < 3) {
    if (r.state.player && r.state.player.alive) greedyBot(r);
    r.step(DT);
    record(tel, r, DT);
    if (tel.firstInputAt === null && tel.actions > 0) tel.firstInputAt = tel.simTime;
  }
  return finish(tel, r);
}

// ---------- random：随机移动 + 随机开火 ----------
function random(seed) {
  const r = createRun(seed);
  tel = makeTracker('random-1', 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = 180;
  while (r.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    const pl = r.state.player;
    if (pl && pl.alive) {
      const roll = rng();
      const dir = roll < 0.25 ? 0 : roll < 0.5 ? 1 : roll < 0.75 ? 2 : 3;
      if (r.setMove(dir).ok) tel.actions += 1;
      if (rng() < 0.5 && r.fire().ok) tel.actions += 1;
      if (tel.firstInputAt === null && tel.actions > 0) tel.firstInputAt = tel.simTime;
    }
    r.step(DT);
    record(tel, r, DT);
  }
  return finish(tel, r);
}

// ---------- noinput：只推进时间，测自动推进/死亡基线 ----------
function noinput(seed) {
  const r = createRun(seed);
  tel = makeTracker('noinput-1', 'noinput', seed);
  const MAX_SEC = 180;
  while (r.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    r.step(DT);
    record(tel, r, DT);
  }
  return finish(tel, r);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'tank-siege-io',
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
    `${r.id.padEnd(10)} policy=${r.policy.padEnd(8)} dur=${r.durationSec}s ` +
    `firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} ` +
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed}`,
  );
}
