// STORM FIGHTER JET · 自对弈
// Node 无头，直接 import sim（无 DOM）。固定 seed 驱动 greedy / random / noinput 三策略，
// 写 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { WORLD } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;

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
        if (e.type === 'coin' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'die') this.deaths += 1;
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
    completed: run.state.phase === 'over',
  };
}

// ---------------- greedy：开阔区逃逸 + 威胁合力回避 + 金币/护盾吸引 ----------------
// 关键：不只看最近威胁，而是对 380px 内所有威胁做「离心合力」，再朝场地中心（开阔区）拉，
// 天然把战机保持在场地中部的开阔地带，追踪导弹转向慢追不上。
function greedySteer(s) {
  const p = s.plane;
  const cx = W / 2;
  const cy = H / 2;
  let ax = 0;
  let ay = 0;

  for (const m of s.missiles) {
    const dx = m.x - p.x;
    const dy = m.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 380) {
      const w = (380 - d) * 2.0;
      ax += ((p.x - m.x) / d) * w;
      ay += ((p.y - m.y) / d) * w;
    }
  }
  for (const rk of s.rocks) {
    const dx = rk.x - p.x;
    const dy = rk.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 320) {
      const w = (320 - d) * 1.8;
      ax += ((p.x - rk.x) / d) * w;
      ay += ((p.y - rk.y) / d) * w;
    }
  }

  // 朝场地中心（开阔区）拉
  ax += (cx - p.x) * 2.5;
  ay += (cy - p.y) * 2.5;

  // 金币吸引
  let coin = null;
  let cd = Infinity;
  for (const c of s.coins) {
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < cd) { cd = d; coin = c; }
  }
  if (coin && cd < 320) {
    ax += ((coin.x - p.x) / cd) * 110;
    ay += ((coin.y - p.y) / cd) * 110;
  }

  // 护盾吸引
  if (!s.shield && s.shields.length) {
    const sh = s.shields[0];
    const d = Math.hypot(sh.x - p.x, sh.y - p.y) || 1;
    ax += ((sh.x - p.x) / d) * 150;
    ay += ((sh.y - p.y) / d) * 150;
  }

  return { ax, ay };
}

function greedy(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'greedy', seed);
  const MAX_SEC = 90;

  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    const { ax, ay } = greedySteer(run.state);
    tel.act(() => run.steer(ax, ay));
  }
  return finish(tel, run);
}

// ---------------- random：随机转向，验证输入鲁棒 ----------------
function random(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = 60;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    if (tel.simTime - (tel.actions / 8) > 1 / 8) {
      const a = rng() * Math.PI * 2;
      tel.act(() => run.steer(Math.cos(a), Math.sin(a)));
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- noinput：什么都不做，测死亡基线 ----------------
function noinput(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 60;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'storm-fighter-jet',
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
    `actions=${r.actions} deaths=${r.deaths} lv=${r.levelsReached} completed=${r.completed}`,
  );
}
