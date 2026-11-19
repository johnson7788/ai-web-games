// FIGHTER KO ARENA · 自对弈（纯 sim，无 DOM）。
// 固定 seed 驱动 greedy / random / noinput 三策略，写 tools/fun/autoplay.json。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { FIGHT } from '../config/game.config.js';
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
        if (e.type === 'levelWin' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'lose') this.deaths += 1;
      }
    },
    noteAction() {
      this.actions += 1;
      if (this.firstInputAt === null) this.firstInputAt = this.simTime;
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
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0,
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

// greedy：贴近后以最快节奏连拳叠 combo，能量满就放超必杀（会连赢三关）
function greedy(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'greedy', seed);
  let guard = 60 * 90;
  while (run.state.phase === 'fight' && guard-- > 0) {
    const f = run.state.fight;
    if (f.inRange && f.playerCooldown <= 0 && f.superLock <= 0) {
      const res = f.playerMeter >= FIGHT.SUPER_METER_MAX ? run.superMove() : run.strike();
      if (res.ok) tel.noteAction();
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// random：乱按——偶尔出手（基本都是扫腿），不格挡不放超必杀，必然被磨死
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let guard = 60 * 60;
  while (run.state.phase === 'fight' && guard-- > 0) {
    const roll = rng();
    if (roll < 0.008) {
      if (run.strike().ok) tel.noteAction();
    } else if (roll < 0.01) {
      if (run.superMove().ok) tel.noteAction();
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// noinput：只推进时间，测自动推进 / 死时间基线
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  let guard = 60 * 30;
  while (run.state.phase === 'fight' && guard-- > 0) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'fighter-ko-arena',
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
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed} ` +
    `events=${r.uniqueEvents} idle=${r.idleSec}s maxGap=${r.maxEventGapSec}s`,
  );
}
