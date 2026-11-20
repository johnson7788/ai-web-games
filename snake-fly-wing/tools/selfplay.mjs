// NEON SERPENT · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成一局并把遥测写进 tools/fun/autoplay.json（schema 见 playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun } from '../src/game/sim.js';
import { SERPENT, WORLD } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function makeTracker(run, policy, seed, carried) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    level: run.state.level,
    simTime: (carried && carried.simTime) ?? 0,
    firstInputAt: (carried && carried.firstInputAt) ?? null,
    firstSuccessAt: (carried && carried.firstSuccessAt) ?? null,
    deaths: (carried && carried.deaths) ?? 0,
    actions: (carried && carried.actions) ?? 0,
    seen: new Set((carried && [...carried.seen]) || []),
    eventTimes: (carried && [...carried.eventTimes]) || [0],
    tick(dt) {
      run.step(dt);
      this.simTime += dt;
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'score' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
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
    completed: false, // 无尽街机：无「通关」态
  };
}

// ---------------- greedy：跟踪下一个缺口中心拍翼，稳定吃到道具并推进到 zone3+ ----------------
function greedy(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  const MAX_SEC = 40;

  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    const serp = run.state.serpent;
    // 下一个未通过、仍在头部右侧的门
    let target = null;
    for (const g of run.state.gates) {
      if (!g.passed && g.x > SERPENT.X - SERPENT.R) { target = g; break; }
    }
    const targetY = target ? target.gapY : WORLD.HEIGHT / 2;

    if (serp.shieldT > 0) {
      // 护盾自动巡航，无需拍翼
      tel.tick(1 / 60);
    } else if (serp.y > targetY + 4) {
      // 头部在缺口下方 → 拍翼上升
      tel.act(() => run.flap());
    } else {
      tel.tick(1 / 60);
    }
  }
  return finish(tel, run);
}

// ---------------- random：低概率随机拍翼，验证输入鲁棒（几乎必然坠机） ----------------
function random(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'random', seed);
  const MAX_SEC = 20;
  let rnd = seed * 2654435761 + 1;
  const rng = () => {
    rnd ^= rnd << 13; rnd ^= rnd >>> 17; rnd ^= rnd << 5; rnd >>>= 0;
    return rnd / 4294967296;
  };

  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    if (rng() < 0.04) tel.act(() => run.flap());
    else tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测自动坠落死亡基线 ----------------
function noinput(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 10;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'snake-fly-wing',
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
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} events=${r.uniqueEvents}`,
  );
}
