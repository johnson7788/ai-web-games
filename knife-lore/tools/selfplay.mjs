// KNIFE LORE · 无头自玩：3 策略（greedy/random/noinput）各跑一局，遥测写 tools/fun/autoplay.json
// greedy 逐关推进（过关解锁下一关），random 乱按，noinput 不操作。纯 node 循环 step，无需 playwright。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { KNIFE, normalizeDeg, angDist } from '../config/gameplay.js';
import { LEVEL_COUNT } from '../config/levels.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const INPUT_LATENCY_MS = 90; // 遥测常量：假定的输入到 sim 延迟

// ---------- greedy：在「无刀间隔 ≥ 刀角×2」时掷 ----------
function greedySafe(run) {
  const p = run.posts[run._nextTarget];
  // 投影到落地时刻的桩角（只按当前转向预估；反转/脉冲会造成误判 → 后期可能崩刀）
  const proj = p.angle + p.dir * p.speedDeg * KNIFE.FLIGHT_SEC;
  const local = normalizeDeg(KNIFE.IMPACT_DEG - proj);
  let minGap = Infinity;
  for (const k of run.stuck) {
    if (k.postIndex !== p.id) continue;
    const g = angDist(local, k.localAngle);
    if (g < minGap) minGap = g;
  }
  return minGap >= KNIFE.GAP_DEG * 2;
}

// ---------- 单关步进，累积整段会话遥测 ----------
function playGreedy(seed) {
  const rec = newRec('greedy', seed);
  for (let lvl = 1; lvl <= LEVEL_COUNT; lvl += 1) {
    rec.levelsReached = lvl;
    const run = createRun({ seed: (seed + lvl * 101) >>> 0, levelIndex: lvl });
    const maxTicks = Math.round(120 / STEP);
    for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
      const shouldThrow = greedySafe(run) && !run.flying;
      run.step({ throw: shouldThrow });
      rec.totalTicks += 1;
      const sec = rec.baseTime + run.time;
      if (shouldThrow) {
        if (rec.firstInputSec < 0) rec.firstInputSec = sec;
        rec.actions += 1;
      }
      const evs = run.drainEvents();
      if (!shouldThrow && evs.length === 0) rec.idleTicks += 1;
      for (const e of evs) {
        rec.kinds.add(e.type);
        if (e.type === 'knifeStick' && rec.firstSuccessSec < 0) rec.firstSuccessSec = sec;
        if (rec.lastEventSec != null) rec.maxGap = Math.max(rec.maxGap, sec - rec.lastEventSec);
        rec.lastEventSec = sec;
      }
    }
    rec.baseTime += run.time;
    if (run.phase === 'failed') { rec.deaths = 1; break; }
    if (run.phase === 'won') { rec.completed = true; break; }
  }
  return finish(rec);
}

function playRandom(seed) {
  const rec = newRec('random', seed);
  rec.levelsReached = 12;
  const run = createRun({ seed: (seed + 77) >>> 0, levelIndex: 12 });
  const maxTicks = Math.round(120 / STEP);
  let rng = mulberry(seed + 999);
  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    const shouldThrow = rng() < 0.14 && !run.flying;
    run.step({ throw: shouldThrow });
    rec.totalTicks += 1;
    const sec = run.time;
    if (shouldThrow) {
      if (rec.firstInputSec < 0) rec.firstInputSec = sec;
      rec.actions += 1;
    }
    const evs = run.drainEvents();
    if (!shouldThrow && evs.length === 0) rec.idleTicks += 1;
    for (const e of evs) {
      rec.kinds.add(e.type);
      if (e.type === 'knifeStick' && rec.firstSuccessSec < 0) rec.firstSuccessSec = sec;
      if (rec.lastEventSec != null) rec.maxGap = Math.max(rec.maxGap, sec - rec.lastEventSec);
      rec.lastEventSec = sec;
    }
  }
  rec.baseTime = run.time;
  if (run.phase === 'failed') rec.deaths = 1;
  return finish(rec);
}

function playNoinput(seed) {
  const rec = newRec('noinput', seed);
  rec.levelsReached = 1;
  const run = createRun({ seed: (seed + 55) >>> 0, levelIndex: 1 });
  const maxTicks = Math.round(120 / STEP);
  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    run.step({ throw: false });
    rec.totalTicks += 1;
    const evs = run.drainEvents();
    if (evs.length === 0) rec.idleTicks += 1;
    for (const e of evs) {
      rec.kinds.add(e.type);
      if (rec.lastEventSec != null) rec.maxGap = Math.max(rec.maxGap, run.time - rec.lastEventSec);
      rec.lastEventSec = run.time;
    }
  }
  rec.baseTime = run.time;
  return finish(rec);
}

// ---------- 记录骨架 ----------
function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function newRec(policy, seed) {
  return {
    policy, seed: seed >>> 0,
    actions: 0, firstInputSec: -1, firstSuccessSec: -1, deaths: 0,
    idleTicks: 0, totalTicks: 0, maxGap: 0, lastEventSec: null,
    kinds: new Set(), levelsReached: 1, completed: false, baseTime: 0,
  };
}

function finish(rec) {
  const durationSec = Math.max(0.5, rec.baseTime);
  return {
    id: `${rec.policy}-${rec.seed}`,
    policy: rec.policy,
    seed: rec.seed,
    durationSec: Math.round(durationSec * 10) / 10,
    actions: rec.actions,
    firstInputSec: rec.firstInputSec < 0 ? 0 : Math.round(rec.firstInputSec * 10) / 10,
    inputLatencyMs: INPUT_LATENCY_MS,
    firstSuccessSec: rec.firstSuccessSec < 0 ? null : Math.round(rec.firstSuccessSec * 10) / 10,
    deaths: rec.deaths,
    idleSec: Math.round((rec.idleTicks / Math.max(1, rec.totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(rec.maxGap * 100) / 100,
    uniqueEvents: rec.kinds.size,
    levelsReached: rec.levelsReached,
    completed: rec.completed,
  };
}

// ---------- 写文件 ----------
function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { genre: 'arcade', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const records = [playGreedy(123), playRandom(456), playNoinput(789)];
writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(lvl=${r.levelsReached},dead=${r.deaths},succ=${r.firstSuccessSec},dur=${r.durationSec}s,act=${r.actions})`).join('  '));
console.log('autoplay.json records:', records.length);
