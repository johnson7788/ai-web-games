// FROG HOP LEAF · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略。
// greedy 会「死亡后重试」，串行打通 1→2→3 关；random 乱跳验证输入鲁棒与死亡存在；
// noinput 只推进时间，测无输入基线。写 tools/fun/autoplay.json（playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32, STEP } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

// ---------------------------------------------------------------- 遥测
function makeTel(policy, seed) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    simTime: 0,
    firstInputAt: null,
    firstSuccessAt: null,
    deaths: 0,
    actions: 0,
    maxLevel: 1,
    seen: new Set(),
    eventTimes: [0],
  };
}

function recordEvents(tel, run) {
  for (const e of run.drainEvents()) {
    tel.seen.add(e.type);
    tel.eventTimes.push(tel.simTime);
    if (e.type === 'win' && tel.firstSuccessAt === null) tel.firstSuccessAt = tel.simTime;
    if (e.type === 'lose') tel.deaths += 1;
  }
}

function tick(run, tel) {
  run.step(STEP);
  tel.simTime += STEP;
  recordEvents(tel, run);
}

function act(run, tel, fn) {
  const res = fn();
  if (res && res.ok) {
    tel.actions += 1;
    if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
    tick(run, tel);
  }
  return res;
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
    level: tel.maxLevel,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: tel.maxLevel,
    completed: run.state.phase === 'won',
  };
}

// ---------------------------------------------------------------- greedy 策略
function enemyNearX(s, leafId, x, radius) {
  for (const e of s.enemies) {
    if (e.leafId === leafId && Math.abs(e.x - x) < radius) return true;
  }
  return false;
}

function thornCovers(s, leafId, x) {
  for (const t of s.thorns) {
    if (t.leafId === leafId && x > t.x - 3 && x < t.x + t.w + 3) return true;
  }
  return false;
}

// 当前叶上、青蛙前进方向上是否有危险（敌人或尖刺）
function curHazardAhead(s, f) {
  const ahead = f.x + f.dir * 70;
  if (enemyNearX(s, f.leafId, ahead, 46)) return true;
  for (const t of s.thorns) {
    if (t.leafId !== f.leafId) continue;
    if (f.dir > 0 && t.x > f.x - 6 && t.x < ahead) return true;
    if (f.dir < 0 && t.x + t.w < f.x + 6 && t.x + t.w > ahead) return true;
  }
  return false;
}

function decide(run) {
  const s = run.state;
  const f = s.frog;
  if (s.phase !== 'playing' || !f.onLeaf) return 'wait';
  const cur = s.leaves[f.leafId];
  const target = s.leaves[f.leafId + 1];
  if (!target) return 'wait';
  const reachable = target.y - cur.y <= 130;
  const landX = f.x + f.dir * 18; // 上升漂移（46px/s × 0.38s ≈ 17.5px）后的大致落点
  const inZone = landX >= target.x + 26 && landX <= target.x + target.w - 26;
  const targetSafe = !enemyNearX(s, target.id, landX, 60) && !thornCovers(s, target.id, landX);
  const danger = curHazardAhead(s, f);

  if (reachable && inZone && targetSafe) return 'jump';
  if (danger && reachable && inZone && targetSafe) return 'jump'; // 前方有危险，赶紧爬升逃命
  if (danger) return 'jump'; // 还没到爬升区就跳，向上躲避（顺带漂移一点）
  return 'wait';
}

function greedyOnce(levelIndex, seed, tel) {
  const run = createRun(levelIndex, { seed });
  const MAX_SEC = 90;
  let stepGuard = MAX_SEC * 60;
  while (stepGuard-- > 0 && run.state.phase === 'playing') {
    if (tel.simTime >= MAX_SEC) break;
    const d = decide(run);
    if (d === 'jump') {
      act(run, tel, () => run.jump());
    } else {
      tick(run, tel);
    }
  }
  return run;
}

function greedy(seed) {
  const tel = makeTel('greedy', seed);
  let finalRun = null;
  for (const lv of [0, 1, 2]) {
    let won = false;
    for (let attempt = 0; attempt < 8 && !won; attempt += 1) {
      const run = greedyOnce(lv, seed + lv * 17 + attempt * 101, tel);
      finalRun = run;
      if (run.state.phase === 'won') {
        won = true;
        tel.maxLevel = lv + 1;
      }
    }
    if (!won) break; // 某一关 8 次都打不过就停（正常不该发生）
  }
  if (!finalRun) finalRun = createRun(0, { seed });
  return finish(tel, finalRun);
}

// ---------------------------------------------------------------- random
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTel('random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = 24;
  while (tel.simTime < MAX_SEC && run.state.phase === 'playing') {
    const roll = rng();
    if (run.state.frog.onLeaf && roll < 0.5) {
      act(run, tel, () => run.jump());
    } else {
      tick(run, tel);
    }
  }
  let guard = 4000;
  while (guard-- > 0 && run.state.phase === 'playing') tick(run, tel);
  return finish(tel, run);
}

// ---------------------------------------------------------------- noinput
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTel('noinput', seed);
  const MAX_SEC = 12;
  while (tel.simTime < MAX_SEC && run.state.phase === 'playing') {
    tick(run, tel);
  }
  return finish(tel, run);
}

// ---------------------------------------------------------------- 主流程
const runs = [greedy(3), random(2), random(4), random(7), noinput(3)];
const payload = {
  game: 'frog-hop-leaf',
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
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed} events=${r.uniqueEvents}`,
  );
}
