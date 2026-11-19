// SKY STRIKE 1942 · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成一局（3 波）并写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const HERO_Y = 610;
const MAX_SEC = 150;

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
        if (e.type === 'kill' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'playerHit') this.deaths += 1;
      }
    },
    act(fn) {
      const res = fn();
      if (res && res.ok) {
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
    levelsReached: run.state.level,
    completed: run.state.phase === 'won',
  };
}

// ---------- greedy：遇险横向规避，安全时对齐最急敌机 / 接道具 ----------
function greedyTarget(run) {
  const st = run.state;
  const hero = st.hero;
  const cols = [110, 260, 410, 560, 710, 860, 1010, 1170];

  function dangerAt(x) {
    let d = 0;
    // 敌机：预测到达英雄高度时的横向落点（更早预警）
    for (const e of st.enemies) {
      const dy = hero.y - e.y;
      if (dy < -30 || dy > 420) continue;
      const t = Math.max(0.05, dy / Math.max(40, e.speed));
      const px = e.type === 2 ? e.x + e.vx * t : e.x;
      const dx = Math.abs(px - x);
      const urgent = dy < 90 ? 1.6 : 1; // 逼近时更危险
      if (dx < 96) d += (1 - dx / 96) * (e.type === 5 ? 45 : 120) * urgent;
    }
    // 岩石：4 血，打不掉，尽早规避
    for (const r of st.rocks) {
      const dy = hero.y - r.y;
      if (dy < -20 || dy > 380) continue;
      const dx = Math.abs(r.x - x);
      if (dx < 140) d += (1 - dx / 140) * 175;
    }
    // 敌弹：预测到达英雄高度时的横向落点
    for (const b of st.enemyBullets) {
      const dy = hero.y - b.y;
      if (dy < -20 || dy > 340) continue;
      const t = dy / Math.max(60, b.vy);
      const px = b.x + b.vx * t;
      const dx = Math.abs(px - x);
      if (dx < 90) d += (1 - dx / 90) * 190;
    }
    return d;
  }

  function safestNear(pref) {
    let best = null;
    for (const c of cols) {
      const cand = { c, d: dangerAt(c), dist: Math.abs(c - pref) };
      if (!best || cand.d < best.d || (cand.d === best.d && cand.dist < best.dist)) best = cand;
    }
    return best;
  }

  const HOME = 640;
  const cur = dangerAt(hero.x);
  if (cur > 12) {
    return { x: safestNear(hero.x).c, y: HERO_Y };
  }

  // 道具：只在安全且不远离中心时接
  for (const p of st.powerups) {
    if (p.y > hero.y - 420 && Math.abs(p.x - HOME) < 280 && dangerAt(p.x) < 30) return { x: p.x, y: HERO_Y };
  }

  // 只在中心附近、落点安全的敌机处补刀（避免长距离横穿弹幕/岩石）
  let bestEnemy = null;
  for (const e of st.enemies) {
    if (Math.abs(e.x - HOME) > 150) continue;
    if (dangerAt(e.x) >= 40) continue;
    if (!bestEnemy || e.y > bestEnemy.y) bestEnemy = e;
  }
  if (bestEnemy) return { x: bestEnemy.x, y: HERO_Y };

  // 守中：敌机会自行进入中心弹道（追踪者/漂移/锯齿都会经过）
  return { x: HOME, y: HERO_Y };
}

function greedy(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'greedy', seed);
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    const t = greedyTarget(run);
    tel.act(() => run.setTarget(t.x, t.y));
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------- random：随机目标点，验证输入鲁棒 ----------
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let nextMove = 0;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    if (tel.simTime >= nextMove) {
      const x = 60 + rng() * (1280 - 120);
      const y = 340 + rng() * (HERO_Y - 340);
      tel.act(() => run.setTarget(x, y));
      nextMove = tel.simTime + 0.4 + rng() * 0.6;
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------- noinput：只推进时间，测自动推进/死时间基线 ----------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(1)];
const payload = {
  game: 'sky-strike-1942',
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
    `actions=${r.actions} deaths=${r.deaths} level=${r.levelsReached} completed=${r.completed}`,
  );
}
