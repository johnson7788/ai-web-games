// BRICK SIX · 无头自玩：3 策略（greedy / random / noinput）各跑一局。
// 直接 node 循环 step（不依赖 playwright），把遥测追加进 tools/fun/autoplay.json。
// 操作模型：bot 每 tick 连续移动 hover 朝向目标格（带震颤），到位后落子 —— 不是 settle-and-hold 假输入。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { neighbors } from '../src/game/hex.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

// ---------- 落位评分（greedy） ----------
function scorePlacement(run, p) {
  const filled = new Set();
  run.cells.forEach((c, i) => { if (c.filled) filled.add(i); });
  for (const i of p.cells) filled.add(i);

  let lines = 0;
  for (const line of run.lines) if (line.every((i) => filled.has(i))) lines += 1;
  let score = lines * 1000 + (lines >= 3 ? 3000 : 0);

  // 让某条线接近满（空 1 格）→ 为后续连消铺路
  for (const line of run.lines) {
    let empty = 0;
    for (const i of line) if (!filled.has(i)) empty += 1;
    if (empty === 1) score += 28;
  }
  // 贴边已有块（更容易拼环）
  let adj = 0;
  for (const i of p.cells) {
    const c = run.cells[i];
    for (const [nq, nr] of neighbors(c.q, c.r)) {
      const ni = run.indexByCoord.get(`${nq},${nr}`);
      if (ni != null && run.cells[ni].filled) adj += 1;
    }
  }
  score += adj * 2 - p.cells.length;
  return score;
}

function pickGreedy(run) {
  const ps = run.enumeratePlacements();
  if (!ps.length) return null;
  let best = ps[0];
  let bestScore = -Infinity;
  for (const p of ps) {
    const s = scorePlacement(run, p);
    if (s > bestScore) { bestScore = s; best = p; }
  }
  return best;
}

function pickRandom(run, rng) {
  const ps = run.enumeratePlacements();
  if (!ps.length) return null;
  return ps[Math.floor(rng() * ps.length)];
}

// 轴向一步逼近（含轻微震颤）
function stepToward(run, fromIdx, toIdx) {
  if (fromIdx == null) return toIdx;
  if (fromIdx === toIdx) return toIdx;
  const a = run.cells[fromIdx];
  const b = run.cells[toIdx];
  const dq = Math.sign(b.q - a.q);
  const dr = Math.sign(b.r - a.r);
  const candidates = [];
  if (dq !== 0) candidates.push([a.q + dq, a.r]);
  if (dr !== 0) candidates.push([a.q, a.r + dr]);
  if (dq !== 0 && dr !== 0) candidates.push([a.q + dq, a.r + dr]);
  // 贪心选离目标更近的一格
  let bestIdx = fromIdx;
  let bestDist = Infinity;
  for (const [q, r] of candidates) {
    const idx = run.indexByCoord.get(`${q},${r}`);
    if (idx == null || run.cells[idx].wall) continue;
    const d = Math.abs(q - b.q) + Math.abs(r - b.r);
    if (d < bestDist) { bestDist = d; bestIdx = idx; }
  }
  return bestIdx;
}

// ---------- 连续操作模型：移动 hover → 到位即落 ----------
function makeContinuousBot(picker) {
  return (run, tick) => {
    const input = { hover: run.hover ?? null, drop: false, select: null, rotate: false };
    if (run._target == null) {
      run._target = picker(run);
      if (run._target == null) return input; // 无合法落位
    }
    const t = run._target;
    if (run.selected !== t.slot) { input.select = t.slot; return input; }
    if (run.shapes[t.slot].rot !== t.rot) { input.rotate = true; return input; }
    const next = stepToward(run, run.hover, t.anchor);
    if (next !== t.anchor) { input.hover = next; return input; }
    input.hover = t.anchor;
    input.drop = true;
    run._target = null;
    return input;
  };
}

function noinput() {
  return { hover: null, drop: false, select: null, rotate: false };
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
  let prevHover = null;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && (input.hover != null || input.drop || input.select != null || input.rotate)) firstInputSec = sec;

    const hoverChanged = input.hover != null && input.hover !== prevHover;
    const acted = hoverChanged || input.drop || input.select != null || input.rotate;
    if (acted) actions += 1;

    const tickEvents = run.drainEvents();
    const idle = !acted && tickEvents.length === 0;
    if (idle) idleTicks += 1;
    prevHover = input.hover;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'clear' && firstSuccessSec < 0) firstSuccessSec = sec;
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
    levelsReached: run.stats.tierReached,
    completed: run.phase !== 'dead',
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ game: 'brick-six', genre: 'puzzle', runs: records, generatedAt: new Date().toISOString() }, null, 2) + '\n');
  return records;
}

const randomRng = mulberry32(456);
const strategies = [
  { name: 'greedy', inputFor: makeContinuousBot((r) => pickGreedy(r)), seed: 123 },
  { name: 'random', inputFor: makeContinuousBot((r) => pickRandom(r, randomRng)), seed: 456 },
  { name: 'noinput', inputFor: noinput, seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(tier=${r.levelsReached},dead=${r.deaths},dur=${r.durationSec}s,success=${r.firstSuccessSec})`).join('  '));
