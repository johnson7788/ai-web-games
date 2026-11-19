// MR HAT ESCAPE · 自对弈（无头，直接 import sim，无 DOM）。
// 三策略：greedy（朝钥匙/门走、遇尖刺/墙就跳）/ random（乱按）/ noinput（基线）。
// 每跑完一局写 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32 } from '../src/game/sim.js';
import { PLAYER } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const DT = 1 / 60;

function makeTracker(run, policy, seed, carried) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    level: run.state.level,
    simTime: carried?.simTime ?? 0,
    firstInputAt: carried?.firstInputAt ?? null,
    firstSuccessAt: carried?.firstSuccessAt ?? null,
    deaths: carried?.deaths ?? 0,
    actions: carried?.actions ?? 0,
    seen: new Set(carried ? [...carried.seen] : []),
    eventTimes: carried ? [...carried.eventTimes] : [0],
    step(input) {
      run.step(DT, input);
      this.simTime += DT;
      const active = !!(input.left || input.right || input.jump || input.hold || input.pointerDown);
      if (active) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
      }
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'win' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'lose') this.deaths += 1;
      }
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
  const out = {
    id: tel.id,
    policy: tel.policy,
    seed: tel.seed,
    level: run.state.level,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.level,
    completed: run.state.phase === 'won',
  };
  out._tel = tel;
  return out;
}

// ---------------- greedy：朝钥匙/门走，遇尖刺或挡路平台就跳 ----------------
function greedyInput(run) {
  const s = run.state;
  const p = s.player;
  const targetX = s.keyCollected ? s.door.x + s.door.w / 2 : s.key ? s.key.x : s.door.x + s.door.w / 2;
  const targetY = s.keyCollected ? s.door.y : s.key ? s.key.y : s.door.y;
  const dir = targetX > p.x + PLAYER.W / 2 ? 1 : -1;
  let jump = false;

  if (p.onGround) {
    const aheadX = dir > 0 ? p.x + PLAYER.W : p.x;
    // 前方尖刺
    for (const sp of s.spikes) {
      const gap = dir > 0 ? sp.x - aheadX : p.x - (sp.x + sp.w);
      if (gap > 35 && gap < 62) { jump = true; break; }
    }
    // 前方挡路的实体平台（脚部高度相交才算墙，地面不算）
    if (!jump) {
      for (const pl of s.platforms) {
        if (pl.kind === 'oneway') continue;
        const gap = dir > 0 ? pl.x - aheadX : p.x - (pl.x + pl.w);
        const atBody = pl.y < p.y + PLAYER.H - 2 && pl.y + pl.h > p.y + 2;
        if (gap > -4 && gap < 70 && atBody) { jump = true; break; }
      }
    }
    // 目标明显高于玩家且在近处
    if (!jump && targetY < p.y - 24 && Math.abs(targetX - (p.x + PLAYER.W / 2)) < 60) jump = true;
  }
  return { left: dir < 0, right: dir > 0, jump, hold: false, pointerX: 0, pointerY: 0, pointerDown: false };
}

function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  const MAX_STEPS = 5000;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (run.state.phase !== 'playing') break;
    tel.step(greedyInput(run));
  }
  return finish(tel, run);
}

function greedy(seed) {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    last = greedyOnce(lv, seed + lv, carried);
    carried = last._tel;
    if (!last.completed) break;
  }
  return last;
}

// ---------------- random：乱按，验证输入鲁棒，天然会撞尖刺死亡 ----------------
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = 90;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    const r = rng();
    const input = {
      left: r < 0.10,
      right: r >= 0.10 && r < 0.85,
      jump: r >= 0.85 && r < 0.87,
      hold: false,
      pointerX: 0,
      pointerY: 0,
      pointerDown: false,
    };
    tel.step(input);
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测自动推进/死时间基线 ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 60;
  const idle = { left: false, right: false, jump: false, hold: false, pointerX: 0, pointerY: 0, pointerDown: false };
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    tel.step(idle);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'mr-hat-escape',
  genre: 'puzzle',
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
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed}`,
  );
}
