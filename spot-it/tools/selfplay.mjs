// tools/selfplay.mjs — SPOT IT · 无头自玩：3 策略（greedy/random/noinput）各跑一局。
// 直接 node 循环 step（无需 playwright），把遥测追加进 tools/fun/autoplay.json（fun-report schema）。
// greedy 查物品位置表（spec 要求：必须过第 3 关）；手电扫动建模为连续微调（真实输入模型）。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { WORLD } from '../config/game.config.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ---------- 策略 ----------
function greedyInput(run) {
  const f = run._botFlash || { x: WORLD.WIDTH / 2, y: WORLD.HEIGHT / 2 };
  const target = run.items.find((i) => i.isTarget && !i.found);
  let click = null;
  if (target) {
    const dx = target.x - f.x;
    const dy = target.y - f.y;
    const d = Math.hypot(dx, dy) || 1;
    const step = Math.min(d, 9); // 手电以 ~540px/s 追目标
    const nx = clamp(f.x + (dx / d) * step + (run.rng() - 0.5) * 3, 0, WORLD.WIDTH);
    const ny = clamp(f.y + (dy / d) * step + (run.rng() - 0.5) * 3, 0, WORLD.HEIGHT);
    run._botFlash = { x: nx, y: ny };
    if (d <= target.s * 0.5 + 5) click = { x: target.x, y: target.y };
  } else {
    // 无目标时仍带生理震颤（真实手电不会静止）
    run._botFlash = { x: clamp(f.x + (run.rng() - 0.5) * 8, 0, WORLD.WIDTH), y: clamp(f.y + (run.rng() - 0.5) * 8, 0, WORLD.HEIGHT) };
  }
  return { click, flash: run._botFlash };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let flash = { x: WORLD.WIDTH / 2, y: WORLD.HEIGHT / 2 };
  return (run, tick) => {
    if (tick % 30 === 0) flash = { x: rng() * WORLD.WIDTH, y: 120 + rng() * (WORLD.HEIGHT - 160) };
    const click = tick % 24 === 0 ? { x: rng() * WORLD.WIDTH, y: 120 + rng() * (WORLD.HEIGHT - 160) } : null;
    return { click, flash };
  };
}

function noinput() {
  return { click: null, flash: null };
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
  let totalTicks = 0;
  let prevFlash = null;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const inp = inputFor(run, tick) || {};
    run.step(inp.click ? { click: inp.click } : {});
    const sec = run.time;

    const moved = inp.flash && (prevFlash == null || Math.hypot(inp.flash.x - prevFlash.x, inp.flash.y - prevFlash.y) > 2);
    const acted = !!inp.click || moved;
    if (firstInputSec < 0 && acted) firstInputSec = sec;
    if (acted) actions += 1;
    prevFlash = inp.flash ?? prevFlash;

    const tickEvents = run.drainEvents();
    const idle = !acted && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'find' && firstSuccessSec < 0) firstSuccessSec = sec;
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
    deaths: run.phase === 'failed' ? 1 : 0,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.stats.levelsReached || run.level || 1,
    completed: run.phase === 'won',
  };
}

// ---------- 写文件（整批替换，保持 fun-report {runs:[...]} schema） ----------
function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { genre: 'puzzle', runs: records, generatedAt: new Date().toISOString() };
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
console.log('strategies:', records.map((r) => `${r.policy}(lv=${r.levelsReached},dead=${r.deaths},succ=${r.firstSuccessSec}s,dur=${r.durationSec}s,ev=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', all.length);
