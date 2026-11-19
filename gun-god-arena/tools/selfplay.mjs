// GUN GOD ARENA · 自对弈：Node 无头直接驱动 sim，跑 greedy / random / noinput 三策略，
// 完成一局并写出 tools/fun/autoplay.json（schema 见 playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { GUN, WORLD } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function makeTracker(run, policy, seed) {
  return {
    id: `${policy}-${seed}`,
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
        if ((e.type === 'kill') && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'fail') this.deaths += 1;
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
    levelsReached: run.state.maxLevel,
    completed: run.state.phase === 'result',
  };
}

// greedy：优先打最近的全息靶；靶清完后若有余弹就打道具箱拿增益。
// 瞄准每次切换目标算一次动作，开火算一次动作。
function greedyStep(run, tel, bot) {
  const st = run.state;
  if (st.phase !== 'playing') return;
  let target = null;
  for (const t of st.targets) if (!target || t.y < target.y) target = t;

  let aimX; let aimY;
  if (target) { aimX = target.x; aimY = target.y; }
  else if (st.crates.length) { aimX = st.crates[0].x; aimY = st.crates[0].y; }
  else { aimX = GUN.X; aimY = 200; }

  if (target !== bot.lastTarget) {
    bot.lastTarget = target;
    bot.fired = false;
    tel.act(() => run.aimAt(aimX, aimY));
  }

  const aligned = Math.abs(st.gunAngle - Math.atan2(aimY - GUN.Y, aimX - GUN.X)) < 0.06;
  if (aligned && !bot.fired && st.bullets > 0 && (target || st.crates.length)) {
    bot.fired = true;
    bot.fireAgainAt = st.time + 1.0;
    tel.act(() => run.fire());
  }
  // 落空补枪：同一目标 1s 后仍存活则再打
  if (bot.fired && st.time >= (bot.fireAgainAt || 0) && target === bot.lastTarget && target && st.bullets > 0) {
    bot.fireAgainAt = st.time + 1.0;
    tel.act(() => run.fire());
  }
}

function greedyRun(seed, maxSec) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  const bot = { lastTarget: null, fired: false, fireAgainAt: 0 };
  while (run.state.phase !== 'result' && tel.simTime < maxSec) {
    greedyStep(run, tel, bot);
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

function randomRun(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  while (run.state.phase !== 'result' && tel.simTime < 30) {
    if (rng() < 0.5) tel.act(() => run.aimAt(rng() * WORLD.WIDTH, 100 + rng() * 420));
    if (rng() < 0.3) tel.act(() => run.fire());
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

function noinputRun(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  while (run.state.phase !== 'result' && tel.simTime < 30) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [
  greedyRun(3, 60),
  greedyRun(4, 60),
  greedyRun(5, 60),
  randomRun(2),
  randomRun(6),
  randomRun(7),
  randomRun(8),
  noinputRun(3),
];

const payload = {
  game: 'gun-god-arena',
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
    `${r.id.padEnd(12)} policy=${r.policy.padEnd(8)} dur=${r.durationSec}s ` +
    `firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} ` +
    `actions=${r.actions} deaths=${r.deaths} level=${r.levelsReached} completed=${r.completed}`,
  );
}
