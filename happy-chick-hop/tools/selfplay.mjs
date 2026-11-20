// HAPPY CHICK HOP · 自对弈（纯逻辑无头，直接 import sim）
// 三策略 greedy / random / noinput → tools/fun/autoplay.json
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32, radiusOf } from '../src/game/sim.js';
import { WORLD, GAME } from '../config/game.config.js';
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
    levelsReached: 1,
    seen: new Set(),
    eventTimes: [0],
    tick(dt) {
      run.step(dt);
      this.simTime += dt;
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'merge' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'lose') this.deaths += 1;
        if (e.type === 'stage') this.levelsReached = Math.max(this.levelsReached, e.stage || 1);
        if (e.type === 'win') this.levelsReached = 3;
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
  const completed = run.state.phase === 'result' && !!(run.state.result && run.state.result.won);
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
    levelsReached: tel.levelsReached,
    completed,
  };
}

// 最空的列（pile 顶最深），用于把多余对象铺开
function lowestColumn(st) {
  const cols = 7;
  const colW = WORLD.WIDTH / cols;
  let bestX = WORLD.WIDTH / 2;
  let bestTop = -Infinity;
  for (let c = 0; c < cols; c += 1) {
    const cx = (c + 0.5) * colW;
    let top = GAME.FLOOR_Y;
    for (const o of st.objects) {
      if (!o.alive) continue;
      const r = radiusOf(o);
      if (Math.abs(o.x - cx) < colW / 2 + r) top = Math.min(top, o.y - r);
    }
    if (top > bestTop) { bestTop = top; bestX = cx; }
  }
  return bestX;
}

function chooseAim(run) {
  const st = run.state;
  const cur = st.current;
  if (cur.rock) return lowestColumn(st);
  let target = null;
  for (const o of st.objects) {
    if (!o.alive || o.rock || o.tier !== cur.tier) continue;
    if (!target || o.y < target.y) target = o;
  }
  if (target) return target.x;
  return lowestColumn(st);
}

// 用锤子减压 / 清石头
function relieve(run) {
  const st = run.state;
  if (st.hammers <= 0) return false;
  let top = null;
  for (const o of st.objects) {
    if (!o.alive) continue;
    const ty = o.y - radiusOf(o);
    if (!top || ty < top.y) top = { o, y: ty };
  }
  if (!top) return false;
  if (top.y < 380) return run.useHammer(top.o.x, top.o.y).ok;
  if (st.hammers >= 2) {
    let rock = null;
    for (const o of st.objects) {
      if (!o.alive || !o.rock) continue;
      const ty = o.y - radiusOf(o);
      if (!rock || ty < rock.y) rock = { o, y: ty };
    }
    if (rock) return run.useHammer(rock.o.x, rock.o.y).ok;
  }
  return false;
}

function greedyOnce(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  let guard = 0;
  while (run.state.phase === 'playing' && tel.simTime < 240 && guard < 40000) {
    guard += 1;
    if (!run.state.current) { tel.tick(1 / 60); continue; }
    if (relieve(run)) {
      tel.tick(1 / 60);
      continue;
    }
    const aim = chooseAim(run);
    tel.act(() => run.setAim(aim));
    tel.act(() => run.drop());
    let settle = 0;
    while (run.state.phase === 'playing' && !run.allSettled() && settle < 150) {
      settle += 1;
      tel.tick(1 / 60);
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

function randomOnce(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32((seed * 7919 + 13) >>> 0);
  const MAX_SEC = 120;
  // 乱按策略：随机 x（收窄到中间 ±90），随机时机 ≈3 次/秒。
  // 收窄范围模拟「玩家把东西全往中间倒」→ 高塔堆叠 → 必然顶到红线判负（deathPresence 证据）。
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    if (rng() < 0.05) {
      const x = WORLD.WIDTH / 2 + (rng() - 0.5) * 180;
      tel.act(() => run.setAim(x));
      tel.act(() => run.drop());
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

function noinputOnce(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 40;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedyOnce(3), randomOnce(2), noinputOnce(3)];
const payload = {
  game: 'happy-chick-hop',
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
    `${r.id.padEnd(12)} policy=${r.policy.padEnd(8)} dur=${r.durationSec}s ` +
    `firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} ` +
    `actions=${r.actions} deaths=${r.deaths} lv=${r.levelsReached} completed=${r.completed}`,
  );
}
