// GUN LEGEND · M1 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { mulberry32 } from '../src/game/rng.js';
import { clamp } from '../config/gameplay.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 180;
const INPUT_LATENCY_MS = 90;

// ---------- greedy：优先近敌 + 连续开火 + 翻滚躲弹 ----------
function greedyInput(run) {
  const p = run.player;
  let tx = 640;
  let ty = 160;
  let bd = Infinity;
  for (const e of run.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bd) { bd = d; tx = e.x; ty = e.y; }
  }

  // 手指追逐目标 + 生理震颤（连续微调，不是 settle-and-hold）
  const finger = run._finger || { x: p.x, y: 160 };
  const dx = tx - finger.x;
  const dy = ty - finger.y;
  const dist = Math.hypot(dx, dy);
  const stepPx = 14;
  const nx = dist > 6 ? finger.x + (dx / dist) * stepPx : finger.x + (run.rng() - 0.5) * 10;
  const ny = dist > 6 ? finger.y + (dy / dist) * stepPx : finger.y + (run.rng() - 0.5) * 10;
  run._finger = { x: nx, y: ny };

  // 有敌弹逼近且翻滚就绪 → 翻滚躲弹
  let roll = false;
  if (run.getHud().rollReady) {
    for (const b of run.enemyBullets) {
      if (Math.hypot(b.x - p.x, b.y - p.y) < 140) { roll = true; break; }
    }
  }

  return { aimX: clamp(nx, 0, 1280), aimY: clamp(ny, 0, 720), fire: true, roll, reload: false };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let rx = 640;
  let ry = 300;
  return (run, tick) => {
    if (tick % 18 === 0) { rx = rng() * 1280; ry = rng() * 720; }
    return { aimX: rx + (rng() - 0.5) * 20, aimY: ry + (rng() - 0.5) * 20, fire: rng() < 0.72, roll: rng() < 0.04, reload: rng() < 0.02 };
  };
}

function noinput() {
  return {};
}

// ---------- 跑一局 ----------
function play(name, inputFor, seed) {
  const run = createRun({ seed });
  const maxTicks = Math.round(MAX_SEC / STEP);

  let firstInputSec = -1;
  let firstSuccessSec = -1;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let actions = 0;
  let idleTicks = 0;
  let prevAimX = null;
  let prevAimY = null;
  let prevFire = false;
  let prevRoll = false;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    const hasInput = input.aimX != null || input.fire || input.roll || input.reload;
    if (firstInputSec < 0 && hasInput) firstInputSec = sec;

    const aimChanged = input.aimX != null && (prevAimX == null || Math.abs(input.aimX - prevAimX) > 1 || Math.abs((input.aimY ?? 0) - (prevAimY ?? 0)) > 1);
    const fireToggled = !!input.fire !== prevFire;
    const rollToggled = !!input.roll !== prevRoll;
    if (aimChanged || fireToggled || rollToggled || input.reload) actions += 1;

    const tickEvents = run.drainEvents();
    const idle = !aimChanged && !fireToggled && !rollToggled && !input.reload && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    prevAimX = input.aimX;
    prevAimY = input.aimY;
    prevFire = !!input.fire;
    prevRoll = !!input.roll;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'kill' && firstSuccessSec < 0) firstSuccessSec = sec;
      if (lastEventSec != null) {
        const gap = sec - lastEventSec;
        if (gap > maxEventGap) maxEventGap = gap;
      }
      lastEventSec = sec;
    }
  }

  const durationSec = run.time;
  return {
    id: `${name}-${seed}`,
    policy: name,
    seed: seed >>> 0,
    durationSec: Math.round(durationSec * 10) / 10,
    actions,
    firstInputSec: firstInputSec < 0 ? -1 : Math.round(firstInputSec * 10) / 10,
    inputLatencyMs: INPUT_LATENCY_MS,
    firstSuccessSec: firstSuccessSec < 0 ? null : Math.round(firstSuccessSec * 10) / 10,
    deaths: run.phase === 'dead' ? 1 : 0,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.stats.roundReached || run.round || 1,
    completed: run.phase !== 'dead',
    maxRound: run.stats.roundReached || run.round || 1,
    score: run.score,
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify({ genre: 'action', runs: records, generatedAt: new Date().toISOString() }, null, 2)}\n`);
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: (run) => greedyInput(run), seed: 123 },
  { name: 'random', inputFor: (run, tick) => randomInput(run, tick), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(round=${r.maxRound},dead=${r.deaths},dur=${r.durationSec}s,kill=${r.firstSuccessSec === null ? 'null' : r.firstSuccessSec + 's'})`).join('  '));
console.log('autoplay.json records:', records.length);
