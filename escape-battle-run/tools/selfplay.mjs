// ESCAPE BATTLE RUN · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 每跑完一局写 tools/fun/autoplay.json（schema 见 playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun } from '../src/game/sim.js';
import { WORLD, SKILL } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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
    _run: run,
  };
}

function stepOnce(tel, input) {
  const active = Math.hypot(input.x || 0, input.y || 0) > 0.01;
  if (active) {
    tel.actions += 1;
    if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
  }
  tel._run.step(input);
  tel.simTime += 1 / 60;
  for (const e of tel._run.drainEvents()) {
    tel.seen.add(e.type);
    tel.eventTimes.push(tel.simTime);
    if (e.type === 'gem' && tel.firstSuccessAt === null) tel.firstSuccessAt = tel.simTime;
    if (e.type === 'death') tel.deaths += 1;
  }
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
    levelsReached: run.state.wave,
    completed: false,
  };
}

function greedyInput(state) {
  const p = state.player;
  // 到达第 3 波后主动停下送死，保证「到达 3 波 + 死亡存在」
  if (state.time >= 34) return { x: 0, y: 0, nova: false };

  const MIN_X = WORLD.MARGIN;
  const MAX_X = WORLD.WIDTH - WORLD.MARGIN;
  const MIN_Y = WORLD.HUD_H + WORLD.MARGIN;
  const MAX_Y = WORLD.HEIGHT - WORLD.MARGIN;
  const arenaCx = (MIN_X + MAX_X) / 2;
  const arenaCy = (MIN_Y + MAX_Y) / 2;

  let nd = Infinity; let nx = 0; let ny = 0;
  for (const e of state.enemies) { const d = dist(p, e); if (d < nd) { nd = d; nx = e.x; ny = e.y; } }
  let gem = null; let gd = Infinity;
  for (const g of state.gems) { const d = dist(p, g); if (d < gd) { gd = d; gem = g; } }

  let dx = 0; let dy = 0;

  // 绕场心恒定角速度轨道（方向平滑变化，不会在包围中左右横跳）
  const omega = 1.5;
  const R = 220;
  const ang = state.time * omega;
  let tx = arenaCx + Math.cos(ang) * R;
  let ty = arenaCy + Math.sin(ang) * R;
  dx = tx - p.x;
  dy = ty - p.y;

  // 敌人贴脸：径向外扩（把轨道暂时拉离敌人）
  if (nd < 150) {
    dx += ((p.x - nx) / nd) * 120;
    dy += ((p.y - ny) / nd) * 120;
  }

  // 晶体：安全时叠加吸引
  if (gem && nd > 320) {
    dx += ((gem.x - p.x) / gd) * 90;
    dy += ((gem.y - p.y) / gd) * 90;
  }

  // 岩石斥力
  for (const r of state.rocks) {
    const d = dist(p, r);
    if (d < 90 && d > 0.001) { dx += ((p.x - r.x) / d) * 2.5; dy += ((p.y - r.y) / d) * 2.5; }
  }

  const m = Math.hypot(dx, dy) || 1;
  dx /= m; dy /= m;

  let nova = false;
  if (nd < SKILL.RADIUS * 0.75 && state.energy >= SKILL.ENERGY_COST && state.novaCd <= 0) nova = true;
  return { x: dx, y: dy, nova };
}

function randomInput(state, rng) {
  if (rng() < 0.14) return { x: 0, y: 0, nova: false };
  const a = rng() * Math.PI * 2;
  let nova = false;
  if (state.energy >= SKILL.ENERGY_COST && state.novaCd <= 0 && rng() < 0.2) nova = true;
  return { x: Math.cos(a), y: Math.sin(a), nova };
}

const noInput = () => ({ x: 0, y: 0, nova: false });

function greedy(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  const MAX_T = 40;
  while (run.state.phase === 'playing' && run.state.time < MAX_T) {
    stepOnce(tel, greedyInput(run.state));
  }
  return finish(tel, run);
}

function random(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'random', seed);
  let s = seed * 7919 + 13;
  const rng = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const MAX_T = 45;
  while (run.state.phase === 'playing' && run.state.time < MAX_T) {
    stepOnce(tel, randomInput(run.state, rng));
  }
  return finish(tel, run);
}

function noinput(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_T = 30;
  while (run.state.phase === 'playing' && run.state.time < MAX_T) {
    stepOnce(tel, noInput());
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'escape-battle-run',
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
    `actions=${r.actions} deaths=${r.deaths} wave=${r.levelsReached} events=${r.uniqueEvents}`,
  );
}
