// DRIFT KING CN · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。驱动 greedy / random / noinput 三策略，
// 写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const STEP = 1 / 60;

const angDelta = (from, to) => {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
};

function nearestAlive(list, p) {
  let best = null;
  let bd = Infinity;
  for (const it of list) {
    if (!it.alive) continue;
    const d = Math.hypot(it.x - p.x, it.y - p.y);
    if (d < bd) { bd = d; best = it; }
  }
  return best;
}

function nearestStar(list, p) {
  let best = null;
  let bd = Infinity;
  for (const it of list) {
    if (!it.alive || it.propKind !== 'star') continue;
    const d = Math.hypot(it.x - p.x, it.y - p.y);
    if (d < bd) { bd = d; best = it; }
  }
  return best;
}

function makeTracker(run, policy, seed) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    level: run.state.stage,
    simTime: 0,
    firstInputAt: null,
    firstSuccessAt: null,
    deaths: 0,
    actions: 0,
    seen: new Set(),
    eventTimes: [0],
    lastSteer: null,
    tick(dt) {
      run.step(dt);
      this.simTime += dt;
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if ((e.type === 'kill' || e.type === 'star') && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'death') this.deaths += 1;
      }
    },
    setSteer(v) {
      if (v !== this.lastSteer) { run.setSteer(v); this.lastSteer = v; }
      if (v !== 0) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
      }
    },
    boost() {
      run.pressBoost();
      this.actions += 1;
      if (this.firstInputAt === null) this.firstInputAt = this.simTime;
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
    level: run.state.stage,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.stage,
    completed: false,
  };
}

function steerToward(p, target) {
  const ang = (Math.atan2(target.y - p.y, target.x - p.x) * 180) / Math.PI;
  const d = angDelta(p.heading, ang);
  return d > 8 ? 1 : d < -8 ? -1 : 0;
}

function steerDodge(p, threat) {
  // 威胁相对前进方向：在左前 → 右转躲，右前 → 左转躲
  const rel = angDelta(p.velAng, (Math.atan2(threat.y - p.y, threat.x - p.x) * 180) / Math.PI);
  return rel < 0 ? 1 : -1;
}

function greedy(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  const MAX_SEC = 150;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    const st = run.state;
    const p = run.player;
    let steer;
    if (st.mode !== 'idle') {
      const target = nearestAlive(run.enemies, p) || nearestAlive(run.props, p);
      steer = target ? steerToward(p, target) : 1;
    } else {
      if (st.boost >= st.boostMax) tel.boost();
      const threat = nearestAlive(run.enemies, p);
      if (threat && Math.hypot(threat.x - p.x, threat.y - p.y) < 320) {
        steer = steerDodge(p, threat);
      } else {
        const target = nearestStar(run.props, p) || nearestAlive(run.props, p);
        steer = target ? steerToward(p, target) : 1;
      }
    }
    tel.setSteer(steer);
    tel.tick(STEP);
  }
  return finish(tel, run);
}

function random(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = 120;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    const r = rng();
    const steer = r < 0.4 ? -1 : r < 0.8 ? 1 : 0;
    if (rng() < 0.04) tel.boost();
    tel.setSteer(steer);
    tel.tick(STEP);
  }
  return finish(tel, run);
}

function noinput(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 120;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    tel.tick(STEP);
  }
  return finish(tel, run);
}

const runs = [greedy(3), greedy(11), greedy(23), random(2), random(5), noinput(3), noinput(7)];
const payload = {
  game: 'drift-king-cn',
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
    `actions=${r.actions} deaths=${r.deaths} stage=${r.levelsReached} events=${r.uniqueEvents}`,
  );
}
