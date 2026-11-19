// MONKEY DASH RUN · 自对弈（无头，直接 import sim，无 DOM）
// 驱动 greedy / random / noinput 三策略，各完成一局并写出 tools/fun/autoplay.json。
// 运行：/opt/homebrew/bin/node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { PLAYER_Y } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

const OBSTACLES = new Set(['cactus', 'wasp', 'rock']);
const PICKUPS = new Set(['banana', 'shield', 'spark']);

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
        if (e.type === 'death') this.deaths += 1;
        if (this.firstSuccessAt === null && (e.type === 'collect' || e.type === 'shield' || e.type === 'spark')) {
          this.firstSuccessAt = this.simTime;
        }
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
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.tier,
    completed: false,
  };
}

const COLLIDE = 68; // 即时碰撞半径（PLAYER_R + 最大障碍半径）
const LOOK = 500;   // 前视距离
const ABOVE = 100;  // 上方缓冲（切换瞬间上方障碍还在逼近）

function blocked(state, lane) {
  return state.entities.some(
    (e) => OBSTACLES.has(e.kind) && e.lane === lane && e.y > PLAYER_Y - ABOVE && e.y < PLAYER_Y + COLLIDE,
  );
}

function approaching(state, lane) {
  return state.entities.some(
    (e) => OBSTACLES.has(e.kind) && e.lane === lane && e.y > PLAYER_Y - LOOK && e.y < PLAYER_Y + COLLIDE,
  );
}

function greedyDecision(state) {
  const lane = state.lane;
  const other = 1 - lane;
  const hereApproach = approaching(state, lane);
  const otherBlocked = blocked(state, other);

  // 本车道有威胁且另一条可落脚 → 切
  if (hereApproach && !otherBlocked) return 'tap';
  // 本车道安全、另一条有收集物且另一条可落脚 → 去收集
  if (!hereApproach) {
    const pickup = state.entities.some(
      (e) => PICKUPS.has(e.kind) && e.lane === other && e.y < PLAYER_Y + COLLIDE && e.y > PLAYER_Y - LOOK,
    );
    if (pickup && !otherBlocked) return 'tap';
  }
  return null;
}

function greedy(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  const MAX_SEC = 42;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    const d = greedyDecision(run.state);
    if (d === 'tap') tel.act(() => run.tap());
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

function random(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = 30;
  let sinceSwitch = 0;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    sinceSwitch += 1 / 60;
    if (sinceSwitch > 0.25 && rng() < 0.5) {
      sinceSwitch = 0;
      tel.act(() => run.tap());
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

function noinput(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 12;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(5)];
const payload = {
  game: 'monkey-dash-run',
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
    `actions=${r.actions} deaths=${r.deaths} tier=${r.levelsReached} events=${r.uniqueEvents}`,
  );
}
