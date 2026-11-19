// ARCHER MISS 3D · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。greedy / random / noinput 三策略，
// 每局结束写 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32 } from '../src/game/sim.js';
import { BALANCE } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

const MELEE_DANGER = 3.0;
const WARN_DODGE_R = 1.35;
const UPGRADE_ORDER = ['double', 'pierce', 'rapid', 'atk', 'fire', 'lightning', 'ice', 'crit', 'spd', 'hp'];

function hasLOS(px, py, tx, ty, rocks) {
  // 线段-圆相交检测：玩家到目标之间是否有岩石挡箭
  for (const r of rocks) {
    const dx = tx - px; const dy = ty - py;
    const len2 = dx * dx + dy * dy;
    let t = 0;
    if (len2 > 1e-9) t = clamp01(((r.x - px) * dx + (r.y - py) * dy) / len2);
    const cx = px + dx * t; const cy = py + dy * t;
    if (Math.hypot(r.x - cx, r.y - cy) < r.r + 0.25) return false;
  }
  return true;
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

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
    lastKillAt: 0,
    tick(dt) {
      run.step(dt);
      this.simTime += dt;
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'kill') { this.lastKillAt = this.simTime; if (this.firstSuccessAt === null) this.firstSuccessAt = this.simTime; }
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
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.level + 1,
    completed: run.state.won === true,
  };
  return out;
}

// ---------------- greedy：风筝 + 躲预警 + 破掩体 + 卡住换位 ----------------
function greedy(seed) {
  const run = createRun({ seed });
  run.start(0);
  const tel = makeTracker(run, 'greedy', seed);
  const rng = mulberry32(seed * 7 + 1);
  const MAX_STEPS = 360 * 60;

  for (let i = 0; i < MAX_STEPS; i += 1) {
    const s = run.state;
    if (s.phase !== 'playing' || s.sub === 'upgrade') {
      if (s.sub === 'upgrade') {
        const pick = UPGRADE_ORDER.find((u) => s.pendingUpgrade.includes(u)) || s.pendingUpgrade[0];
        tel.act(() => run.chooseUpgrade(pick));
        continue;
      }
      break;
    }
    const p = s.player;
    let nearest = null; let bd = Infinity;
    for (const m of s.monsters) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < bd) { bd = d; nearest = m; } }
    let warn = null; let wd = Infinity;
    for (const w of s.warnings) { const d = Math.hypot(w.x - p.x, w.y - p.y); if (d < wd) { wd = d; warn = w; } }

    let dx = 0; let dy = 0;
    if (nearest && bd < MELEE_DANGER) {
      // 近战贴脸：逃离最近敌人，并朝场地中心偏移（避免被逼进墙角）
      let fx = p.x - nearest.x; let fy = p.y - nearest.y; const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
      let cx = -p.x; let cy = -p.y; const cl = Math.hypot(cx, cy) || 1; cx /= cl; cy /= cl;
      dx = fx * 0.7 + cx * 0.3; dy = fy * 0.7 + cy * 0.3;
    } else if (warn && wd < WARN_DODGE_R) {
      // 预警圈罩住玩家：走出圈子即可（弹道飞向旧位置会打空）
      let fx = p.x - warn.x; let fy = p.y - warn.y; const fl = Math.hypot(fx, fy) || 1; dx = fx / fl; dy = fy / fl;
    } else if (nearest && !hasLOS(p.x, p.y, nearest.x, nearest.y, s.rocks)) {
      // 目标被岩石挡住：绕切向走，换出射击角度
      const a = Math.atan2(nearest.y - p.y, nearest.x - p.x) + (rng() < 0.5 ? 1 : -1) * 1.2;
      dx = Math.cos(a); dy = Math.sin(a);
    } else if (tel.simTime - tel.lastKillAt > 4 && nearest) {
      // 长时间无击杀：朝目标靠近一点，突破僵局
      let fx = nearest.x - p.x; let fy = nearest.y - p.y; const fl = Math.hypot(fx, fy) || 1; dx = fx / fl; dy = fy / fl;
    } else {
      dx = 0; dy = 0; // 站定自动射击
    }
    tel.act(() => run.setMove(dx, dy));
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- random：乱走 + 偶尔停，验证输入鲁棒 ----------------
function random(seed) {
  const run = createRun({ seed });
  run.start(0);
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 13 + 3);
  const MAX_SEC = 90;
  let dir = { x: 0, y: 0 };
  let nextPick = 0;
  while (run.state.phase === 'playing' && run.state.sub !== 'upgrade' && tel.simTime < MAX_SEC) {
    if (tel.simTime >= nextPick) {
      nextPick = tel.simTime + 0.3 + rng() * 0.4;
      if (rng() < 0.35) dir = { x: 0, y: 0 };
      else { const a = rng() * Math.PI * 2; dir = { x: Math.cos(a), y: Math.sin(a) }; }
    }
    tel.act(() => run.setMove(dir.x, dir.y));
    tel.tick(1 / 60);
  }
  // 兜底：随机策略最多 90s，若还活着（不太可能）也结算
  while (run.state.phase === 'playing' && run.state.sub === 'upgrade') {
    tel.act(() => run.chooseUpgrade(run.state.pendingUpgrade[0]));
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测死时间/自动推进基线 ----------------
function noinput(seed) {
  const run = createRun({ seed });
  run.start(0);
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 60;
  while (run.state.phase === 'playing' && run.state.sub !== 'upgrade' && tel.simTime < MAX_SEC) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(5)];
const payload = {
  game: 'archer-miss-3d',
  genre: 'action',
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
