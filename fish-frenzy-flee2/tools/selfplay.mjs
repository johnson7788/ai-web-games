// FISH FRENZY FLEE2 · 自对弈（纯 sim，无 DOM）
// 三策略 greedy / random / noinput → tools/fun/autoplay.json（schema 见 references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const DT = 1 / 60;
const TAU = Math.PI * 2;

function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }

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
        if ((e.type === 'join' || e.type === 'coin' || e.type === 'eatPred') && this.firstSuccessAt === null) {
          this.firstSuccessAt = this.simTime;
        }
        if (e.type === 'lose') this.deaths += 1;
      }
    },
    act(fn) {
      const res = fn();
      if (res !== false) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
        // 一次被接受的转向 = 一次可感知的画面变化，计入事件时间轴
        this.eventTimes.push(this.simTime);
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
  const out = {
    id: tel.id,
    policy: tel.policy,
    seed: tel.seed,
    level: run.state.stage,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.stage,
    completed: run.state.phase === 'over',
  };
  out._tel = tel;
  return out;
}

function nearest(arr, sx, sy) {
  let best = null;
  let bd = Infinity;
  for (const e of arr) {
    const d = dist(e.x, e.y, sx, sy);
    if (d < bd) { bd = d; best = e; }
  }
  return { e: best, d: bd };
}

function greedyAngle(run) {
  const s = run.state.school;
  let fx = 0;
  let fy = 0;
  const addVec = (dx, dy, w) => {
    const d = Math.hypot(dx, dy) || 1;
    fx += (dx / d) * w;
    fy += (dy / d) * w;
  };

  // 目标：最近小鱼 > 狂暴星 > 金币
  const p = nearest(run.state.prey, s.x, s.y);
  if (p.e) addVec(p.e.x - s.x, p.e.y - s.y, 3.5);

  const st = nearest(run.state.stars, s.x, s.y);
  if (st.e && run.state.frenzy <= 0) addVec(st.e.x - s.x, st.e.y - s.y, 2.8);

  const c = nearest(run.state.coins, s.x, s.y);
  if (c.e) addVec(c.e.x - s.x, c.e.y - s.y, 1.1);

  // 狂暴期：主动追最近的鲨鱼反吃
  if (run.state.frenzy > 0) {
    const pr = nearest(run.state.predators, s.x, s.y);
    if (pr.e) addVec(pr.e.x - s.x, pr.e.y - s.y, 4.0);
  } else {
    // 逃离最近鲨鱼（越近权重越大）
    const pr = nearest(run.state.predators, s.x, s.y);
    if (pr.e && pr.d < 560) {
      const w = pr.d < 150 ? 12 : 6.5 * (1 - pr.d / 560);
      addVec(s.x - pr.e.x, s.y - pr.e.y, w);
    }
  }

  // 逃离最近暗礁
  const rk = nearest(run.state.rocks, s.x, s.y);
  if (rk.e && rk.d < 210) {
    addVec(s.x - rk.e.x, s.y - rk.e.y, 5 * (1 - rk.d / 210));
  }

  if (fx === 0 && fy === 0) return s.dir;
  return Math.atan2(fy, fx);
}

function greedy(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'greedy', seed);
  const MAX_SEC = 55; // 存活 40s 即达第 3 关；再多留缓冲
  let sinceAct = 0;
  while (tel.simTime < MAX_SEC && run.state.phase === 'playing') {
    sinceAct -= DT;
    if (sinceAct <= 0) {
      sinceAct = 0.35;
      const ang = greedyAngle(run);
      tel.act(() => { run.setDirection(ang); return true; });
    }
    tel.tick(DT);
  }
  return finish(tel, run);
}

function random(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = 45;
  let sinceAct = 0;
  while (tel.simTime < MAX_SEC && run.state.phase === 'playing') {
    sinceAct -= DT;
    if (sinceAct <= 0) {
      sinceAct = 0.5;
      const ang = rng() * TAU;
      tel.act(() => { run.setDirection(ang); return true; });
    }
    tel.tick(DT);
  }
  return finish(tel, run);
}

function noinput(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 40;
  while (tel.simTime < MAX_SEC && run.state.phase === 'playing') {
    tel.tick(DT);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'fish-frenzy-flee2',
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
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} stage=${r.levelsReached} done=${r.completed}`,
  );
}
