// TANK CLASSIC 1990 · 自对弈（bot 遥测）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成 L1（greedy 连打到 L3）并写出 tools/fun/autoplay.json。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32, DIR_LIST } from '../src/game/sim.js';
import { BOARD } from '../config/game.config.js';
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
    level: run.state.level + 1,
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
        if (e.type === 'kill' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'playerHit') this.deaths += 1;
      }
    },
    act(fn) {
      const res = fn();
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
        this.tick(1 / 60);
      } else {
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
    level: tel.level,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: tel.level,
    completed: run.state.phase === 'won',
  };
}

// greedy：朝最近敌军对齐后开火；被墙挡住就沿墙侧移（用 sim 的 probe 判定真实碰撞）。
const SOLID_BULLET = new Set(['brick', 'rock', 'steel', 'base']);

function lineClear(state, pc, pr, ec, er) {
  if (pc === ec) {
    const a = pr < er ? pr : er;
    const b = pr < er ? er : pr;
    for (let r = a + 1; r < b; r += 1) if (SOLID_BULLET.has(state.grid[r][pc].t)) return false;
    return true;
  }
  if (pr === er) {
    const a = pc < ec ? pc : ec;
    const b = pc < ec ? ec : pc;
    for (let c = a + 1; c < b; c += 1) if (SOLID_BULLET.has(state.grid[pr][c].t)) return false;
    return true;
  }
  return false;
}

function shootDir(state, enemy) {
  const p = state.player;
  const pc = Math.floor((p.x - BOARD.OX) / BOARD.TILE);
  const pr = Math.floor((p.y - BOARD.OY) / BOARD.TILE);
  const ec = Math.floor((enemy.x - BOARD.OX) / BOARD.TILE);
  const er = Math.floor((enemy.y - BOARD.OY) / BOARD.TILE);
  if (pc === ec && er !== pr) {
    const dir = er < pr ? 'up' : 'down';
    if (lineClear(state, pc, pr, ec, er)) return dir;
  } else if (pr === er && ec !== pc) {
    const dir = ec < pc ? 'left' : 'right';
    if (lineClear(state, pc, pr, ec, er)) return dir;
  }
  return null;
}

const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };

function greedyControl(state, run) {
  const p = state.player;
  if (!p.alive) return { dir: null, fire: false };
  let best = null;
  let bd = Infinity;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  if (!best) return { dir: null, fire: false };
  const shoot = shootDir(state, best);
  if (shoot) return { dir: shoot, fire: true };

  const dx = best.x - p.x;
  const dy = best.y - p.y;
  const primary = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  const secondary = Math.abs(dx) > Math.abs(dy) ? (dy > 0 ? 'down' : 'up') : (dx > 0 ? 'right' : 'left');
  const order = [primary, secondary, OPP[secondary], OPP[primary]];
  for (const d of order) if (run.probe(d)) return { dir: d, fire: true };
  return { dir: null, fire: false };
}

function greedy(seed) {
  let last = null;
  for (const lv of [0, 1, 2]) {
    const run = createRun(lv, { seed: seed + lv });
    const tel = makeTracker(run, 'greedy', seed + lv, null);
    const MAX_SEC = 200;
    while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
      tel.act(() => run.setInput(greedyControl(run.state, run)));
    }
    last = finish(tel, run);
    if (!last.completed) break;
  }
  return last;
}

function randomOnce(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = 150;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    const dir = DIR_LIST[Math.floor(rng() * 4)];
    const fire = rng() < 0.22;
    tel.act(() => run.setInput({ dir, fire }));
  }
  return finish(tel, run);
}

function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 150;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [greedy(3), randomOnce(2), noinput(3)];
const payload = {
  game: 'tank-classic-1990',
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
