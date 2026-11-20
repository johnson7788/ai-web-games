// MARIO BIRD HOP · 自对弈（Node 无头，直接 import sim，无 DOM）。
// greedy 串行打 L1→L2→L3（推进率门槛）；random / noinput 只跑 L1 作基线。
// 输出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
import { createRun } from '../src/game/sim.js';
import { LAYOUT } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const TILE = LAYOUT.TILE;
const DT = 1 / 60;

// ---------------- 贪心控制器（有全信息，但只用左/右/跳输入） ----------------
// 扫描前方最近的障碍（坑/尖刺/落岩/怪物，取最近者），返回 { type, col, dist }。
function scanHazard(run) {
  const p = run.state.player;
  const px = p.x + p.w / 2;
  const c = Math.floor(px / TILE);
  const lv = run.level;
  let best = null;
  const consider = (type, dist, col) => {
    if (!best || dist < best.dist) best = { type, dist, col };
  };
  for (let cc = c + 1; cc <= c + 9; cc += 1) {
    if (cc >= lv.cols) break;
    const dist = cc - c;
    if (!lv.solid.has(`${13},${cc}`)) { consider('pit', dist, cc); break; } // 坑即地面断层，其后更远
    if (lv.spikes.has(`${12},${cc}`) || lv.spikes.has(`${11},${cc}`)) consider('spike', dist, cc);
    if (lv.rocks.has(`${12},${cc}`) || lv.rocks.has(`${11},${cc}`)) consider('rock', dist, cc);
  }
  for (const m of run.state.monsters) {
    if (!m.alive) continue;
    if (m.x + m.w < px) continue;                 // 已在身后
    const dist = (m.x - px) / TILE;
    if (dist < 9) consider('monster', dist, Math.floor(m.x / TILE));
  }
  return best;
}

function itemAbove(run, c) {
  const lv = run.level;
  const pr = Math.floor((run.state.player.y + run.state.player.h / 2) / TILE);
  for (let cc = c - 1; cc <= c + 2; cc += 1) {
    if (cc < 0 || cc >= lv.cols) continue;
    for (let rr = pr - 1; rr >= 3; rr -= 1) {
      // 只跳浮空的收集品；不跳箱子（顶箱会让身体失速下坠，干扰越障时机）
      for (const co of run.state.coins) if (!co.taken && co.r === rr && co.c === cc) return true;
      for (const s of run.state.stars) if (!s.taken && s.r === rr && s.c === cc) return true;
      for (const p of run.state.powerups) if (!p.taken && p.r === rr && p.c === cc) return true;
    }
  }
  return false;
}

function decide(run) {
  const p = run.state.player;
  const px = p.x + p.w / 2;
  const c = Math.floor(px / TILE);
  let jump = false;
  if (p.onGround) {
    const h = scanHazard(run);
    if (h) {
      if (h.type === 'monster') {
        jump = h.dist <= 2.5;                     // 怪接近起跳，跃过或踩它
      } else {
        const dist = h.col - c;                   // 障碍在前方几格
        jump = dist >= 0 && dist <= 2;            // 邻近障碍才起跳，先别乱跳
      }
    } else if (itemAbove(run, c)) {
      jump = true;                                 // 无障碍才贪头顶的箱子/金币/星
    }
  }
  return { left: false, right: true, jump };
}

// ---------------- 遥测 tracker ----------------
function makeTracker(policy, carried) {
  return {
    id: `${policy}-1`,
    policy,
    simTime: (carried && carried.simTime) ?? 0,
    firstInputAt: (carried && carried.firstInputAt) ?? null,
    firstSuccessAt: (carried && carried.firstSuccessAt) ?? null,
    deaths: (carried && carried.deaths) ?? 0,
    actions: (carried && carried.actions) ?? 0,
    seen: new Set(carried ? [...carried.seen] : []),
    eventTimes: carried ? [...carried.eventTimes] : [0],
    levelsReached: (carried && carried.levelsReached) ?? 1,
  };
}

function tick(tel, run, inp) {
  tel.simTime += DT;
  run.step(inp);
  for (const e of run.drainEvents()) {
    tel.seen.add(e.type);
    tel.eventTimes.push(tel.simTime);
    if (e.type === 'win' && tel.firstSuccessAt === null) tel.firstSuccessAt = tel.simTime;
    if (e.type === 'lose') tel.deaths += 1;
  }
  if (inp.left || inp.right || inp.jump) {
    tel.actions += 1;
    if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
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
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: tel.levelsReached,
    completed: run.state.phase === 'won',
    _carry: {
      simTime: tel.simTime,
      firstInputAt: tel.firstInputAt,
      firstSuccessAt: tel.firstSuccessAt,
      deaths: tel.deaths,
      actions: tel.actions,
      seen: [...tel.seen],
      eventTimes: [...tel.eventTimes],
      levelsReached: tel.levelsReached,
    },
  };
}

// ---------------- greedy：串行打 L1→L2→L3 ----------------
function greedyOnce(levelIndex, carried) {
  const run = createRun(levelIndex);
  const tel = makeTracker('greedy', carried);
  tel.levelsReached = levelIndex + 1;
  const MAX_STEPS = 60 * 90; // 90s 上限
  for (let i = 0; i < MAX_STEPS; i += 1) {
    if (run.state.phase !== 'playing') break;
    tick(tel, run, decide(run));
  }
  return finish(tel, run);
}

function greedy() {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    last = greedyOnce(lv, carried);
    if (!last.completed) break;
    carried = last._carry;
    delete last._carry;
  }
  return last;
}

// ---------------- random：随机乱按 L1，验证输入鲁棒 ----------------
function lcg(seed) {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function random(seed) {
  const run = createRun(0);
  const tel = makeTracker('random');
  const rng = lcg(seed * 7919 + 13);
  const MAX_STEPS = 60 * 75; // 75s 上限
  for (let i = 0; i < MAX_STEPS; i += 1) {
    if (run.state.phase !== 'playing') break;
    const roll = rng();
    const inp = {
      left: roll < 0.33,
      right: roll >= 0.33 && roll < 0.66,
      jump: roll >= 0.66 && roll < 0.8,
    };
    tick(tel, run, inp);
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测基线（应被巡逻怪击杀） ----------------
function noinput() {
  const run = createRun(0);
  const tel = makeTracker('noinput');
  const MAX_STEPS = 60 * 20; // 20s 上限
  for (let i = 0; i < MAX_STEPS; i += 1) {
    if (run.state.phase !== 'playing') break;
    tick(tel, run, { left: false, right: false, jump: false });
  }
  return finish(tel, run);
}

const runs = [greedy(), random(2), noinput()];
for (const r of runs) delete r._carry;

const payload = {
  game: 'mario-bird-hop',
  genre: 'platformer',
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
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} lvl=${r.levelsReached} completed=${r.completed}`,
  );
}
