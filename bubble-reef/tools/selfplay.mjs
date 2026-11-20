// tools/selfplay.mjs — BUBBLE REEF · 无头自玩：3 策略（greedy / random / noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { bestAim } from '../src/game/ai.js';
import { MAX_AIM, WILDCARD_COMBO } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// ---------- 策略：greedy「射最大同色簇的挂点」 ----------
function greedyInput(run) {
  const color = run.current && run.current.wildcard ? 0 : (run.current ? run.current.c : 1);
  const aim = bestAim(run.grid, run.parities, color, run.level.drift);
  const targetAngle = aim ? aim.angle : 0;
  const goodTarget = !!(aim && aim.attach && aim.attach.size >= 3);

  // 百搭：连击满 3 且当前颜色没有 ≥3 的好挂点时，武装百搭
  const useWildcard = run.combo >= WILDCARD_COMBO && run.current && !run.current.wildcard && !goodTarget;

  // 真实拖动模型：手指以有限角速度追目标 + 生理震颤
  const cur = run._botAim ?? 0;
  const toward = clamp(targetAngle - cur, -0.07, 0.07);
  const tremor = (run.rng() - 0.5) * 0.008;
  const nextAim = clamp(cur + toward + (Math.abs(targetAngle - cur) > 0.05 ? 0 : tremor), -MAX_AIM, MAX_AIM);
  run._botAim = nextAim;

  // 瞄准收敛后才发射（sim 内部会保证 flying 非空时不再发射）
  const ready = Math.abs(nextAim - targetAngle) < 0.03;
  return { angle: nextAim, shoot: ready, useWildcard, usePreview: false };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let angle = 0;
  return (run, tick) => {
    if (tick % 20 === 0) angle = -MAX_AIM + rng() * 2 * MAX_AIM;
    return { angle, shoot: tick % 3 === 0, useWildcard: rng() < 0.05, usePreview: false };
  };
}

function noinput() {
  return { shoot: false };
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
  let prevAngle = 0;
  let prevShoot = false;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && (run.phase === 'playing' || run.phase === 'cleared'); tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    const hasAim = typeof input.angle === 'number';
    const shoot = !!input.shoot;
    if (firstInputSec < 0 && (hasAim || shoot || input.useWildcard)) firstInputSec = sec;

    const aimChanged = hasAim && Math.abs(input.angle - prevAngle) > 0.02;
    const shootToggled = shoot !== prevShoot;
    if (aimChanged || shootToggled || input.useWildcard) actions += 1;
    prevAngle = hasAim ? input.angle : prevAngle;
    prevShoot = shoot;

    const tickEvents = run.drainEvents();
    const idle = !shoot && !aimChanged && !input.useWildcard && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'match' && firstSuccessSec < 0) firstSuccessSec = sec;
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
    levelsReached: run.stats.levelsReached || 1,
    completed: run.phase !== 'dead',
    score: Math.floor(run.score),
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { game: 'bubble-reef', genre: 'puzzle', source: 'bot', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: (run) => greedyInput(run), seed: 123 },
  { name: 'random', inputFor: (run, tick) => randomInput(run, tick), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(lvl=${r.levelsReached},dead=${r.deaths},dur=${r.durationSec}s,score=${r.score},events=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', all.length);
