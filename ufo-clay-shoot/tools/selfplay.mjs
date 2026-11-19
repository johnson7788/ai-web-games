// UFO CLAY SHOOT · 自对弈：Node 无头直接驱动 sim，跑 greedy / random / noinput 三策略，
// 完成一局并写出 tools/fun/autoplay.json（schema 见 playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { WAVE_SEC, ENEMIES, LASER } from '../config/game.config.js';
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
        if (e.type === 'lose') this.deaths += 1;
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
  const levelsReached = Math.min(3, Math.floor(tel.simTime / WAVE_SEC) + 1);
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
    levelsReached,
    completed: levelsReached >= 3,
  };
}

// greedy：只打敌机。优先级：躲敌方子弹 > 击杀敌机（对准+开火）> 躲小行星 > 回中。
// 敌机优先于小行星，因为杀掉敌机能从源头减少弹幕。瞄准带提前量（敌机横向漂移 × 激光飞行时间）。
function greedyStep(run, tel, prev, bot) {
  const st = run.state;
  const p = st.player;
  let left = false, right = false, up = false, down = false;

  let target = null;
  for (const e of st.enemies) if (!target || e.y > target.y) target = e;
  let aimX = null;
  if (target) {
    const T = Math.max(0, (p.y - target.y) / LASER.SPEED);
    aimX = target.x + target.xSpeed * T;
  }

  // 敌方子弹预判
  let laserDodge = 0;
  let laserSoonest = Infinity;
  for (const l of st.enemyLasers) {
    if (l.vy <= 0) continue;
    const t = (p.y - l.y) / l.vy;
    if (t < 0 || t > 2.5) continue;
    const lx = l.x + l.vx * t;
    if (Math.abs(lx - p.x) < 46 && t < laserSoonest) {
      laserSoonest = t;
      laserDodge = Math.abs(lx - p.x) < 8 ? (p.x < 640 ? 1 : -1) : (lx < p.x ? 1 : -1);
    }
  }
  // 小行星预判
  let astDodge = 0;
  let astSoonest = Infinity;
  for (const a of st.asteroids) {
    if (a.vy <= 0) continue;
    const t = (p.y - a.y) / a.vy;
    if (t < 0 || t > 2.5) continue;
    const ax = a.x + a.vx * t;
    if (Math.abs(ax - p.x) < 52 && t < astSoonest) {
      astSoonest = t;
      astDodge = Math.abs(ax - p.x) < 8 ? (p.x < 640 ? 1 : -1) : (ax < p.x ? 1 : -1);
    }
  }

  let dodgeDir = 0;
  if (st.invincible) {
    // 无敌：放心对准敌机打
    if (aimX != null) { if (aimX < p.x - 12) left = true; else if (aimX > p.x + 12) right = true; }
  } else if (laserSoonest < 1.0) {
    dodgeDir = laserDodge;
  } else if (aimX != null && !(astSoonest < 0.8)) {
    if (aimX < p.x - 10) left = true;
    else if (aimX > p.x + 10) right = true;
  } else if (astSoonest < 1.0) {
    dodgeDir = astDodge;
  } else {
    if (p.x < 600) right = true; else if (p.x > 680) left = true;
  }

  if (dodgeDir < 0 && p.x < 130) dodgeDir = 1;
  if (dodgeDir > 0 && p.x > 1150) dodgeDir = -1;
  // 保持躲闪：近威胁锁定方向，持续躲到解除
  if (dodgeDir !== 0 && (laserSoonest < 0.8 || astSoonest < 0.8)) {
    bot.commitDir = dodgeDir;
    bot.commitUntil = st.time + 0.5;
  }
  if (st.time < bot.commitUntil && bot.commitDir !== 0) dodgeDir = bot.commitDir;
  if (dodgeDir !== 0 && !st.invincible) {
    if (dodgeDir < 0) left = true; else right = true;
    if (p.y < 620) down = true;
  }

  const fire = !!(aimX != null && Math.abs(aimX - p.x) < 46);

  run.input.left = left; run.input.right = right; run.input.up = up; run.input.down = down;
  const changed = left !== prev.left || right !== prev.right || up !== prev.up || down !== prev.down;
  return { fire, changed, left, right, up, down };
}

function greedyRun(seed, maxSec) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  const bot = { commitDir: 0, commitUntil: 0 };
  let prev = { left: false, right: false, up: false, down: false };
  while (run.state.phase === 'playing' && tel.simTime < maxSec) {
    const d = greedyStep(run, tel, prev, bot);
    if (d.fire) tel.act(() => run.fire());
    if (d.changed) {
      tel.actions += 1;
      if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
    }
    prev = { left: d.left, right: d.right, up: d.up, down: d.down };
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

function randomRun(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let nextChange = 0;
  while (run.state.phase === 'playing' && tel.simTime < 60) {
    if (tel.simTime >= nextChange) {
      run.input.left = rng() < 0.3;
      run.input.right = rng() < 0.3;
      run.input.up = rng() < 0.12;
      run.input.down = rng() < 0.12;
      nextChange = tel.simTime + 0.2 + rng() * 0.5;
      tel.actions += 1;
      if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
    }
    if (rng() < 0.28) tel.act(() => run.fire());
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

function noinputRun(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  while (run.state.phase === 'playing' && tel.simTime < 30) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [
  greedyRun(3, 55),
  greedyRun(4, 55),
  greedyRun(5, 55),
  randomRun(2),
  randomRun(6),
  randomRun(7),
  noinputRun(3),
];

const payload = {
  game: 'ufo-clay-shoot',
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
    `actions=${r.actions} deaths=${r.deaths} wave=${r.levelsReached} completed=${r.completed}`,
  );
}
