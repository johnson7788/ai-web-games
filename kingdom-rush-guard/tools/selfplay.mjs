// KINGDOM RUSH GUARD · 自对弈（bot 遥测）
// Node 无头，直接 import sim（无 DOM）。跑 greedy / random / noinput 三策略，
// 写出 tools/fun/autoplay.json（schema 见 playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVEL_COUNT, TOWER_DEFS, TOWER_ORDER } from '../config/levels.js';
import { GAME } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

// 建造优先级：每列优先类型（先近基地方向铺激光，再补轨道炮/特斯拉/无人机）
const BUILD_PLAN = ['laser', 'laser', 'rail', 'laser', 'tesla', 'drone'];
const UPGRADE_ORDER = ['rail', 'laser', 'tesla', 'drone'];

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
    seen: new Set(carried ? [...carried.seen] : []),
    eventTimes: carried ? [...carried.eventTimes] : [0],
    tick(dt) {
      run.step(dt);
      this.simTime += dt;
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'win' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'lose') this.deaths += 1;
      }
    },
    act(fn) {
      const res = fn();
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
      }
      this.tick(1 / 60);
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
    levelsReached: tel.level,
    completed: run.state.phase === 'won',
  };
}

// ---------------- 策略 ----------------

function pickBuild(run) {
  const spots = run.buildSpots();
  for (let col = 0; col < 6; col += 1) {
    for (let lane = 0; lane < 3; lane += 1) {
      const spot = spots.find((s) => s.lane === lane && s.id === lane * 6 + col);
      if (!spot || spot.blocked) continue;
      if (run.state.towers.some((t) => t.spotIdx === spot.id)) continue;
      const type = BUILD_PLAN[col];
      if (run.state.gold >= TOWER_DEFS[type].cost) return { spotIdx: spot.id, type };
    }
  }
  return null;
}

function pickUpgrade(run) {
  for (const type of UPGRADE_ORDER) {
    for (const t of run.state.towers) {
      if (t.type !== type || t.level >= 4) continue;
      const cost = Math.round(TOWER_DEFS[type].cost * 0.7);
      if (run.state.gold >= cost) return t.spotIdx;
    }
  }
  return null;
}

function greedyOnce(levelIndex, seed, carried) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, carried);
  tel.level = levelIndex + 1;

  let guard = 0;
  while (run.state.phase === 'playing' && guard < 300000) {
    guard += 1;
    if (run.state.cores.length) { tel.act(() => run.collectCore()); continue; }
    if (run.state.orbitalCharges >= GAME.ORBITAL_CHARGES_NEEDED) { tel.act(() => run.useOrbital()); continue; }
    const b = pickBuild(run);
    if (b) { tel.act(() => run.buildTower(b.spotIdx, b.type)); continue; }
    const u = pickUpgrade(run);
    if (u != null) { tel.act(() => run.upgradeTower(u)); continue; }
    tel.tick(1 / 60);
  }
  return { tel, run };
}

function greedy(seed) {
  let carried = null;
  let lastTel = null;
  let lastRun = null;
  for (const lv of [0, 1, 2]) {
    const { tel, run } = greedyOnce(lv, seed + lv, carried);
    lastTel = tel;
    lastRun = run;
    carried = tel;
    if (run.state.phase !== 'won') break;
  }
  return finish(lastTel, lastRun);
}

function randomOnce(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const spots = run.buildSpots().filter((s) => !s.blocked);

  let guard = 0;
  while (run.state.phase === 'playing' && guard < 300000 && tel.simTime < 120) {
    guard += 1;
    const roll = rng();
    if (run.state.cores.length && roll < 0.14) {
      tel.act(() => run.collectCore());
      continue;
    }
    if (roll < 0.52) {
      // 疯狂建塔：优先便宜塔，占用一切可用的开放建造点
      const open = spots.filter((s) => !run.state.towers.some((t) => t.spotIdx === s.id));
      const cheap = TOWER_ORDER.filter((ty) => run.state.gold >= TOWER_DEFS[ty].cost)
        .sort((a, b) => TOWER_DEFS[a].cost - TOWER_DEFS[b].cost)[0];
      if (open.length && cheap) {
        const spot = open[Math.floor(rng() * open.length)];
        tel.act(() => run.buildTower(spot.id, cheap));
      } else {
        tel.tick(1 / 60);
      }
      continue;
    }
    if (roll < 0.66) {
      // 乱升级
      const t = run.state.towers[Math.floor(rng() * Math.max(1, run.state.towers.length))];
      if (t && t.level < 4 && run.state.gold >= Math.round(TOWER_DEFS[t.type].cost * 0.7)) tel.act(() => run.upgradeTower(t.spotIdx));
      else tel.tick(1 / 60);
      continue;
    }
    if (roll < 0.84 && run.state.towers.length > 1) {
      // 乱卖塔（制造金币周转，也制造更多操作），同时保留塔数不足导致失败
      const t = run.state.towers[Math.floor(rng() * run.state.towers.length)];
      tel.act(() => run.sellTower(t.spotIdx));
      continue;
    }
    if (roll < 0.9) {
      tel.act(() => run.useOrbital());
      continue;
    }
    tel.tick(1 / 60);
  }
  while (run.state.phase === 'playing' && tel.simTime < 150) tel.tick(1 / 60);
  return finish(tel, run);
}

function noinputOnce(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  let guard = 0;
  while (run.state.phase === 'playing' && guard < 150 * 60) { guard += 1; tel.tick(1 / 60); }
  return finish(tel, run);
}

const runs = [greedy(3), randomOnce(2), noinputOnce(3)];
const payload = {
  game: 'kingdom-rush-guard',
  genre: 'puzzle',
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
