// WILDLAND RALLY · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。greedy/random/noinput 三策略各跑一局，
// 写出 tools/fun/autoplay.json（schema 见 playtest-protocol §3）。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { WORLD, MATCH } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const STEP = 1 / 60;
const CX = (WORLD.MIN_X + WORLD.MAX_X) / 2;
const CY = (WORLD.MIN_Y + WORLD.MAX_Y) / 2;
const MAX_SEC = 240;

const hypot = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const nrm = (x, y) => { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };

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
        if (e.type === 'kill' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
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
    levelsReached: Math.max(1, run.state.wave || 1),
    completed: run.state.phase === 'won',
  };
}

// ---------------- greedy：中距风筝 + 绕圈躲弹 + 低血吃道具 ----------------
function greedyControl(run) {
  const st = run.state;
  const p = st.player;
  const DANGER = 300; // 低于此距离=拉开（玩家射程 340，敌人射程 290）

  let ne = null; let nd = Infinity;
  for (const e of st.enemies) {
    if (e.hp <= 0) continue;
    const d = hypot(e.x, e.y, p.x, p.y);
    if (d < nd) { nd = d; ne = e; }
  }
  let np = null; let pd = Infinity;
  for (const pk of st.pickups) {
    const d = hypot(pk.x, pk.y, p.x, p.y);
    if (d < pd) { pd = d; np = pk; }
  }
  let dx = 0; let dy = 0; let dash = false; let nova = false;

  let close = 0;
  for (const e of st.enemies) if (e.hp > 0 && hypot(e.x, e.y, p.x, p.y) < 180) close += 1;
  if (close >= 3 && p.novaCd <= 0) nova = true;

  const useful = np && (np.type === 'heal' || np.type === 'shield');
  if (p.hp < p.maxHp * 0.6 && useful) {
    const a = nrm(np.x - p.x, np.y - p.y);
    dx = a.x; dy = a.y;
    if (ne && nd < 130 && p.dashCd <= 0) dash = true;
  } else if (nd < DANGER && ne) {
    // 危险：按距离加权远离所有近敌 + 最近敌切向绕圈 + 中心偏移
    let fx = 0; let fy = 0;
    for (const e of st.enemies) {
      if (e.hp <= 0) continue;
      const d = hypot(e.x, e.y, p.x, p.y);
      if (d > 400) continue;
      const away = nrm(p.x - e.x, p.y - e.y);
      const w = 1 / (d + 30);
      fx += away.x * w; fy += away.y * w;
    }
    const na = nrm(p.x - ne.x, p.y - ne.y);
    const tan = { x: na.y, y: -na.x };
    const tc = nrm(CX - p.x, CY - p.y);
    fx += na.x * 0.5 + tan.x * 0.4 + tc.x * 0.3;
    fy += na.y * 0.5 + tan.y * 0.4 + tc.y * 0.3;
    const l = Math.hypot(fx, fy) || 1;
    dx = fx / l; dy = fy / l;
    if (nd < 120 && p.dashCd <= 0) dash = true;
  } else if (ne) {
    // 安全：贴近敌人到自动炮射程内（切向绕圈躲弹）
    const toE = nrm(ne.x - p.x, ne.y - p.y);
    let tan = { x: toE.y, y: -toE.x };
    if (tan.x * (CX - p.x) + tan.y * (CY - p.y) < 0) tan = { x: -tan.x, y: -tan.y };
    dx = toE.x * 0.7 + tan.x * 0.7;
    dy = toE.y * 0.7 + tan.y * 0.7;
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  } else if (np) {
    const a = nrm(np.x - p.x, np.y - p.y);
    dx = a.x; dy = a.y;
  } else {
    const a = nrm(CX - p.x, CY - p.y);
    dx = a.x; dy = a.y;
  }
  return { dx, dy, dash, nova };
}

function greedy(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    const c = greedyControl(run);
    tel.act(() => run.move(c.dx, c.dy));
    if (c.dash) tel.act(() => run.dash());
    if (c.nova) tel.act(() => run.nova());
    tel.tick(STEP);
  }
  return finish(tel, run);
}

// ---------------- random：随机乱走/乱冲，验证输入鲁棒 ----------------
function random(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let dir = { x: 1, y: 0 };
  let dirT = 0;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    dirT -= STEP;
    if (dirT <= 0) {
      const a = rng() * Math.PI * 2;
      dir = { x: Math.cos(a), y: Math.sin(a) };
      dirT = 0.4 + rng() * 0.6;
    }
    tel.act(() => run.move(dir.x, dir.y));
    if (rng() < 0.02) tel.act(() => run.dash());
    if (rng() < 0.01) tel.act(() => run.nova());
    tel.tick(STEP);
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测死亡存在性 ----------------
function noinput(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    tel.tick(STEP);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(7)];
const payload = { game: 'wildland-rally', genre: 'arcade', source: 'bot', version: 'm1', runs };

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${OUT} (${runs.length} runs)`);
for (const r of runs) {
  console.log(
    `${r.id.padEnd(10)} policy=${r.policy.padEnd(8)} dur=${r.durationSec}s ` +
    `firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} ` +
    `actions=${r.actions} deaths=${r.deaths} wave=${r.levelsReached} completed=${r.completed}`,
  );
}
