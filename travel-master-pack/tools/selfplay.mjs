// Travel Master Pack · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32 } from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

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
    tick(dt) {
      run.step(dt);
      this.simTime += dt;
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if ((e.type === 'collect' || e.type === 'dodge') && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'lose') this.deaths += 1;
      }
    },
    act(fn) {
      const res = fn();
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
      }
      return res;
    },
  };
}

function finish(tel, run, completed) {
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
    levelsReached: run.state.level,
    completed,
  };
}

const BAND_BOTTOM = GAME.PLAYER_Y + GAME.PLAYER_BAND;

// 某车道上、已经进入警戒窗口的最近路障（null = 安全）
function laneDanger(run, lane, yMin = 300) {
  const s = run.state;
  let near = null;
  for (const e of s.entities) {
    if (e.kind !== 'barrier' || e.removed || e.passed || e.lane !== lane) continue;
    if (e.y >= yMin && e.y < BAND_BOTTOM) {
      if (!near || e.y < near) near = e;
    }
  }
  return near;
}

// 离当前车道最近的、无 imminent 路障的车道（-1 = 没有）
function safestLane(run) {
  const s = run.state;
  let best = -1;
  let bestDist = 99;
  for (let l = 0; l < GAME.LANE_COUNT; l += 1) {
    if (l === s.lane) continue;
    if (!laneDanger(run, l)) {
      const d = Math.abs(l - s.lane);
      if (d < bestDist) { bestDist = d; best = l; }
    }
  }
  return best;
}

// 某车道上、已经进入视野下半部的最近包裹/护盾（null = 没有）
function pickupIn(run, lane, yMin = 200) {
  const s = run.state;
  let near = null;
  for (const e of s.entities) {
    if ((e.kind !== 'goods' && e.kind !== 'shield') || e.removed || e.passed || e.lane !== lane) continue;
    if (e.y >= yMin && e.y < BAND_BOTTOM) {
      if (!near || e.y > near.y) near = e;
    }
  }
  return near;
}

function tryMove(run, tel, memo, dir) {
  if (tel.act(() => run.move(dir)).ok) memo.lastAct = tel.simTime;
}

// ---------------- greedy：躲威胁、追包裹、有盾吃一次撞击、无目标巡逻 ----------------
function greedyOnce(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  const memo = { tanked: false, lastAct: -99 };
  const MAX_SEC = 120;
  while (run.state.phase !== 'over' && tel.simTime < MAX_SEC) {
    const s = run.state;
    const curThreat = laneDanger(run, s.lane);

    if (s.shield > 0 && !memo.tanked && curThreat) {
      // 有盾：故意吃一次撞击，触发 shieldBlock（保证事件覆盖）
      memo.tanked = true;
      memo.lastAct = tel.simTime;
    } else if (curThreat) {
      const target = safestLane(run);
      if (target >= 0) {
        tryMove(run, tel, memo, target > s.lane ? 1 : -1);
      } else {
        // 无处可躲：朝远离中心的方向跑（边缘更安全）
        const dir = s.lane <= 1 ? -1 : 1;
        if (s.lane + dir >= 0 && s.lane + dir < GAME.LANE_COUNT) tryMove(run, tel, memo, dir);
      }
    } else {
      // 无威胁：追安全车道里最近的包裹/护盾
      let target = -1;
      let bestY = -1;
      for (let l = 0; l < GAME.LANE_COUNT; l += 1) {
        if (laneDanger(run, l)) continue;
        const p = pickupIn(run, l);
        if (p && p.y > bestY) { bestY = p.y; target = l; }
      }
      if (target >= 0 && target !== s.lane) {
        tryMove(run, tel, memo, target > s.lane ? 1 : -1);
      } else if (tel.simTime - memo.lastAct > 0.9) {
        // 巡逻：保持操作频率与首输入
        const dirs = s.lane <= 1 ? [1, -1] : [-1, 1];
        for (const d of dirs) {
          const nl = s.lane + d;
          if (nl < 0 || nl >= GAME.LANE_COUNT) continue;
          if (!laneDanger(run, nl)) { tryMove(run, tel, memo, d); break; }
        }
        memo.lastAct = tel.simTime;
      }
    }

    tel.tick(1 / 60);
    if (s.level >= 3) break; // 到达第 3 级即可收尾
  }
  return finish(tel, run, run.state.level >= 3);
}

// ---------------- random：随机换道，验证输入鲁棒 + 死亡存在性 ----------------
function randomOnce(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = 60;
  while (run.state.phase !== 'over' && tel.simTime < MAX_SEC) {
    if (rng() < 0.12) tel.act(() => run.move(rng() < 0.5 ? -1 : 1));
    tel.tick(1 / 60);
  }
  return finish(tel, run, false);
}

// ---------------- noinput：只推进时间，测自动推进/死亡基线 ----------------
function noinputOnce(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 60;
  while (run.state.phase !== 'over' && tel.simTime < MAX_SEC) {
    tel.tick(1 / 60);
  }
  return finish(tel, run, false);
}

const runs = [greedyOnce(3), randomOnce(2), noinputOnce(3)];
const payload = {
  game: 'travel-master-pack',
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
    `actions=${r.actions} deaths=${r.deaths} lv=${r.levelsReached} completed=${r.completed}`,
  );
}
