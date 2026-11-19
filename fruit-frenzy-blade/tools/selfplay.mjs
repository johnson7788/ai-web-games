// fruit-frenzy-blade · 自对弈：Node 无头直接驱动 sim（无 DOM）。
// 三策略 greedy / random / noinput，写出 tools/fun/autoplay.json。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { WORLD } from '../config/game.config.js';
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
        if ((e.type === 'fruitSliced' || e.type === 'goldenSliced') && this.firstSuccessAt === null) {
          this.firstSuccessAt = this.simTime;
        }
        if (e.type === 'gameOver') this.deaths += 1;
      }
    },
    act(fn) {
      const ok = fn();
      if (ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
      }
      return ok;
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
    levelsReached: run.state.wave,
    completed: run.state.phase === 'gameover',
  };
}

// greedy：优先切可得分目标（普通/金果），避开炸弹与岩石，直到 90s 或出局。
function greedy(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  const MAX_SEC = 90;
  while (tel.simTime < MAX_SEC && run.state.phase === 'playing') {
    tel.tick(1 / 60);
    let target = null;
    for (const f of run.state.fruits) {
      if (f.state !== 'flying') continue;
      if ((f.type === 'fruit' || f.type === 'golden') && f.y > 20 && f.y < WORLD.HEIGHT - 20) {
        target = f;
        break;
      }
    }
    if (target) {
      tel.act(() => run.cut(target.x - 3, target.y - 3, target.x + 3, target.y + 3) > 0);
    }
  }
  return finish(tel, run);
}

// random：高频随机乱划，验证输入鲁棒 + 事件密度。
function random(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32((seed * 7919 + 13) >>> 0);
  const MAX_SEC = 90;
  let nextSwipe = 0.3;
  while (tel.simTime < MAX_SEC && run.state.phase === 'playing') {
    tel.tick(1 / 60);
    if (tel.simTime >= nextSwipe) {
      const x0 = rng() * WORLD.WIDTH;
      const y0 = rng() * WORLD.HEIGHT;
      const ang = rng() * Math.PI * 2;
      const len = 40 + rng() * 140;
      const x1 = x0 + Math.cos(ang) * len;
      const y1 = y0 + Math.sin(ang) * len;
      tel.act(() => {
        run.cut(x0, y0, x1, y1);
        return true;
      });
      nextSwipe = tel.simTime + 0.15 + rng() * 0.25;
    }
  }
  return finish(tel, run);
}

// noinput：只推进时间，测自动推进 / 死时间基线（漏果扣命直至出局）。
function noinput(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 60;
  while (tel.simTime < MAX_SEC && run.state.phase === 'playing') {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'fruit-frenzy-blade',
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
    `actions=${r.actions} deaths=${r.deaths} wave=${r.levelsReached} events=${r.uniqueEvents}`,
  );
}
