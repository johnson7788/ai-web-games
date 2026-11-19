// MY PLANET GROW · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。greedy / random / noinput 三策略，
// 跑完一局并写出 tools/fun/autoplay.json（schema 见 playtest-protocol §3）。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32 } from '../src/game/sim.js';
import { WORLD, GAME } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const DT = 1 / 60;
const SPEED = 340; // 贪心移动速度 px/s

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

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
        if ((e.type === 'meteor' || e.type === 'gold') && this.firstSuccessAt === null) {
          this.firstSuccessAt = this.simTime;
        }
        if (e.type === 'gameover') this.deaths += 1;
      }
    },
    act(fn) {
      const res = fn();
      if (res && res.ok && res.moved) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
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
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.planet.tier + 1, // 进化档作为推进关卡（1 基）
    completed: run.state.phase === 'over',
  };
}

function nearest(run, kinds) {
  const s = run.state;
  let best = null;
  let bd = Infinity;
  for (const e of s.entities) {
    if (!kinds.includes(e.type)) continue;
    const d = dist(e.x, e.y, s.planet.x, s.planet.y);
    if (d < bd) { bd = d; best = e; }
  }
  return { e: best, d: bd };
}

function moveToward(tel, run, tx, ty) {
  const s = run.state;
  const d = Math.max(1, dist(s.planet.x, s.planet.y, tx, ty));
  const dx = ((tx - s.planet.x) / d) * SPEED * DT;
  const dy = ((ty - s.planet.y) / d) * SPEED * DT;
  tel.act(() => run.movePlanet(dx, dy));
}

// greedy：躲黑洞 + 追最近的流星，尽量叠连击
function greedy(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'greedy', seed);
  const MAX_SEC = 120;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    const hole = nearest(run, ['hole']);
    if (hole.e && hole.d < 120) {
      // 逃离黑洞
      const s = run.state;
      const d = Math.max(1, hole.d);
      const awayX = (s.planet.x - hole.e.x) / d;
      const awayY = (s.planet.y - hole.e.y) / d;
      tel.act(() => run.movePlanet(awayX * SPEED * DT, awayY * SPEED * DT));
    } else {
      const m = nearest(run, ['meteor', 'gold']);
      if (m.e) moveToward(tel, run, m.e.x, m.e.y);
    }
    tel.tick(DT);
  }
  run.endRun();
  tel.tick(0);
  return finish(tel, run);
}

// random：随机方向移动，验证输入鲁棒
function random(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32((seed * 7919 + 13) >>> 0);
  const MAX_SEC = 60;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    const roll = rng();
    if (roll < 0.75) {
      const a = rng() * Math.PI * 2;
      tel.act(() => run.movePlanet(Math.cos(a) * SPEED * DT, Math.sin(a) * SPEED * DT));
    }
    tel.tick(DT);
  }
  run.endRun();
  tel.tick(0);
  return finish(tel, run);
}

// noinput：只推进时间，测死时间与死亡存在性基线
function noinput(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 60;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    tel.tick(DT);
  }
  run.endRun();
  tel.tick(0);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'my-planet-grow',
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
    `actions=${r.actions} deaths=${r.deaths} tier=${r.levelsReached} completed=${r.completed}`,
  );
}
