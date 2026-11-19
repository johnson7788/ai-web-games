// BUBBLE SHOOTER POP · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成一局并写出 tools/fun/autoplay.json（schema 见 playtest-protocol §3）。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { WORLD, GAME as G } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function newTel(policy, seed) {
  return {
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

function finish(tel, run) {
  const times = tel.eventTimes.slice().sort((a, b) => a - b);
  let maxGap = 0;
  let idleSec = 0;
  for (let i = 1; i < times.length; i += 1) {
    const gap = times[i] - times[i - 1];
    if (gap > maxGap) maxGap = gap;
    if (gap > 3) idleSec += gap - 3;
  }
  const wave = run.state.wave;
  return {
    id: `${tel.policy}-1`,
    policy: tel.policy,
    seed: tel.seed,
    level: wave,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: wave,
    completed: false,
  };
}

function tick(run, tel) {
  run.step(1 / 60);
  tel.simTime += 1 / 60;
  for (const e of run.drainEvents()) {
    tel.seen.add(e.type);
    tel.eventTimes.push(tel.simTime);
    if (e.type === 'pop' && tel.firstSuccessAt === null) tel.firstSuccessAt = tel.simTime;
    if (e.type === 'lose') tel.deaths += 1;
  }
}

function act(tel, res) {
  if (res && res.ok) {
    tel.actions += 1;
    if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
  }
}

// ---------------- greedy：躲避危险，优先对准「分高 + 紧急」的泡泡 ----
function greedyDecide(run) {
  const s = run.state;
  const c = s.cannon;
  let danger = null;
  for (const b of s.bubbles) {
    if (b.dead) continue;
    if (b.y > c.y - 180 && Math.abs(b.x - c.x) < 90) { danger = b; break; }
  }
  if (danger) return { x: c.x + (danger.x >= c.x ? -220 : 220) };
  let best = null;
  let bs = -1;
  for (const b of s.bubbles) {
    if (b.dead || b.y < 40) continue;
    const sc = b.value * 2 + (WORLD.HEIGHT - b.y) * 0.4;
    if (sc > bs) { bs = sc; best = b; }
  }
  return best ? { x: best.x } : null;
}

function greedy(seed) {
  const run = createRun({ seed });
  const tel = newTel('greedy', seed);
  let decideT = 0;
  let burstT = 0.5;
  const MAX = 120;
  while (run.state.phase === 'playing' && tel.simTime < MAX) {
    decideT -= 1 / 60;
    burstT -= 1 / 60;
    if (decideT <= 0) {
      const d = greedyDecide(run);
      if (d) act(tel, run.steer(d.x));
      decideT = 0.15;
    }
    if (burstT <= 0) {
      act(tel, run.burst());
      burstT = 0.9;
    }
    tick(run, tel);
  }
  return finish(tel, run);
}

// ---------------- random：随机定位 + 随机连发，验证输入鲁棒 ----
function random(seed) {
  const run = createRun({ seed });
  const tel = newTel('random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let decideT = 0;
  const MAX = 120;
  while (run.state.phase === 'playing' && tel.simTime < MAX) {
    decideT -= 1 / 60;
    if (decideT <= 0) {
      act(tel, run.steer(G.CANNON_MIN_X + rng() * (G.CANNON_MAX_X - G.CANNON_MIN_X)));
      if (rng() < 0.4) act(tel, run.burst());
      decideT = 0.12;
    }
    tick(run, tel);
  }
  return finish(tel, run);
}

// ---------------- noinput：什么都不做，测自动推进与死时间基线 ----
function noinput(seed) {
  const run = createRun({ seed });
  const tel = newTel('noinput', seed);
  const MAX = 120;
  while (run.state.phase === 'playing' && tel.simTime < MAX) {
    tick(run, tel);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'bubble-shooter-pop',
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
    `${r.id.padEnd(12)} policy=${r.policy.padEnd(8)} dur=${r.durationSec}s ` +
    `firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} ` +
    `actions=${r.actions} deaths=${r.deaths} wave=${r.levelsReached} events=${r.uniqueEvents}`,
  );
}
