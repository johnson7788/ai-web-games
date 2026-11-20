// tools/selfplay.mjs — 无头自玩：3 策略（greedy/random/noinput）各跑一局，写入 tools/fun/autoplay.json。
// 直接 node 循环 step（不需要 playwright），遥测 schema 与 fun-report 硬校验一字不差。
// 输入用真实操作模型：连续微调 + 生理震颤，不 settle-and-hold。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { WORLD, STEP } from '../config/game.config.js';
import { clamp, MOLE, RAIN, SWARM } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;
const TREMOR = 6;            // 生理震颤幅度 px
const FINGER_SPEED = 1500;   // 手指/光标追目标速度 px/s（打地鼠快甩）
const MOLE_NEUTRAL = { x: 110, y: 80 }; // 无安全目标时的中立点（避开所有洞口）

function tremor(rng, amp = TREMOR) { return (rng() - 0.5) * amp; }

function nextMachineToClear(run) {
  for (let m = 0; m < 3; m += 1) if (!(run.clearedMask & (1 << m))) return m;
  return 0;
}

function chase(run, targetX, targetY) {
  // 连续光标/手指：以 FINGER_SPEED 追目标 + 震颤，返回带震颤的坐标
  const fx = run._fingerX ?? targetX;
  const fy = run._fingerY ?? targetY;
  const dx = targetX - fx;
  const dy = targetY - fy;
  const dist = Math.hypot(dx, dy) || 1;
  const step = Math.min(dist, FINGER_SPEED * STEP);
  run._fingerX = fx + (dx / dist) * step;
  run._fingerY = fy + (dy / dist) * step;
  return { x: run._fingerX + tremor(run.rng), y: run._fingerY + tremor(run.rng) };
}

function greedyInput(run) {
  if (run.phase === 'hall') return { pick: nextMachineToClear(run) };
  if (run.phase === 'result') return { continue: true };
  if (run.phase !== 'playing') return {};

  if (run.machine === 0) {
    // 追最近的冒头安全目标；没有就退回中立点（连续移动 = 真实操作）
    const up = run.sub.holes.filter((h) => h.up && !h.hazard);
    let tx = MOLE_NEUTRAL.x;
    let ty = MOLE_NEUTRAL.y;
    if (up.length) {
      let best = null; let bd = Infinity;
      const fx = run._fingerX ?? MOLE_NEUTRAL.x;
      const fy = run._fingerY ?? MOLE_NEUTRAL.y;
      for (const h of up) { const d = Math.hypot(h.x - fx, h.y - fy); if (d < bd) { bd = d; best = h; } }
      if (best) { tx = best.x; ty = best.y; }
    }
    const p = chase(run, tx, ty);
    return { tapX: p.x, tapY: p.y };
  }

  if (run.machine === 1) {
    // 追最接近篮筐的金币
    let best = null; let bestY = -Infinity;
    for (const it of run.sub.items) if (it.kind === 'coin' && it.y > bestY) { bestY = it.y; best = it; }
    const target = best ? best.x : (run._botAim ?? WORLD.WIDTH / 2);
    run._botAim = target;
    return { steerX: target + tremor(run.rng) };
  }

  if (run.machine === 2) {
    // 追最靠下（近飞船）的活蜂列，持续开火
    const alive = run.sub.bees.filter((b) => b.alive);
    let target = null; let bestY = -Infinity;
    for (const b of alive) if (b.y > bestY) { bestY = b.y; target = b; }
    const tx = target ? target.x : (run._botAim ?? WORLD.WIDTH / 2);
    run._botAim = tx;
    return { steerX: tx + tremor(run.rng), fire: true };
  }
  return {};
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  return (run) => {
    if (run.phase === 'hall') return { pick: Math.floor(rng() * 3) };
    if (run.phase === 'result') return { continue: true };
    if (run.phase !== 'playing') return {};
    if (run.machine === 0) {
      if (rng() < 0.18) return { tapX: rng() * WORLD.WIDTH, tapY: 140 + rng() * 420 };
      return {};
    }
    if (run.machine === 1) return { steerX: rng() * WORLD.WIDTH };
    return { steerX: rng() * WORLD.WIDTH, fire: rng() < 0.35 };
  };
}

function noinput() { return {}; }

// ---------- 跑一局 ----------
function play(name, inputFor, seed, stopWhen = null) {
  const run = createRun({ seed });
  const maxTicks = Math.round(MAX_SEC / STEP);

  let firstInputSec = -1;
  let firstSuccessSec = -1;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let actions = 0;
  let idleTicks = 0;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks; tick += 1) {
    if (run.phase === 'gameover' || run.phase === 'grandprix') break;
    if (stopWhen && stopWhen(run)) break;
    totalTicks += 1;
    const input = inputFor(run) || {};
    run.step(input);
    const sec = tick * STEP;

    // 输入动作：本 tick 提供了任何操控输入（定位/开火/点按/选台）即视为动作；
    // 连续光标/摇杆/扳机都是真实操作模型，不 settle-and-hold。
    const acted = input.pick != null || input.continue || input.pity
      || input.tapX != null || input.steerX != null || !!input.fire || !!input.move;
    if (acted) actions += 1;

    if (firstInputSec < 0 && acted) firstInputSec = sec;

    const tickEvents = run.drainEvents();
    const idle = !acted && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if ((e.type === 'hit' || e.type === 'cleared') && firstSuccessSec < 0) firstSuccessSec = sec;
      if (lastEventSec != null) {
        const gap = sec - lastEventSec;
        if (gap > maxEventGap) maxEventGap = gap;
      }
      lastEventSec = sec;
    }
  }

  const durationSec = totalTicks * STEP;
  return {
    id: `${name}-${seed}`,
    policy: name,
    seed: seed >>> 0,
    durationSec: Math.round(durationSec * 10) / 10,
    actions,
    firstInputSec: firstInputSec < 0 ? -1 : Math.round(firstInputSec * 10) / 10,
    inputLatencyMs: INPUT_LATENCY_MS,
    firstSuccessSec: firstSuccessSec < 0 ? null : Math.round(firstSuccessSec * 10) / 10,
    deaths: run.phase === 'gameover' ? 1 : 0,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.stats.bestRank || run.rank || 1,
    completed: run.phase === 'grandprix',
    bestRank: run.stats.bestRank,
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ runs: records, generatedAt: new Date().toISOString() }, null, 2) + '\n');
  return records;
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: greedyInput, seed: 123, stopWhen: (r) => r.stats.bestRank >= 3 },
  { name: 'random', inputFor: randomInput, seed: 456 },
  { name: 'noinput', inputFor: noinput, seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed, s.stopWhen));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(rank=${r.bestRank},dead=${r.deaths},dur=${r.durationSec}s,idle=${r.idleSec}s,first=${r.firstSuccessSec})`).join('  '));
console.log('autoplay.json records:', all.length);
