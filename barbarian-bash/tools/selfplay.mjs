// BARBARIAN BASH · 自对弈（Node 无头，直接 import sim，无 DOM）
// 用固定 seed 驱动 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
import { createRun } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function makeTel(policy, seed) {
  return {
    policy,
    seed,
    level: 0,
    simTime: 0,
    firstInputAt: null,
    firstSuccessAt: null,
    deaths: 0,
    actions: 0,
    seen: new Set(),
    eventTimes: [0],
    run: null,
    bind(run) {
      this.run = run;
      this.level = run.state.level;
    },
    tick(dt) {
      this.run.step(dt);
      this.simTime += dt;
      for (const e of this.run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'win' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'lose') this.deaths += 1;
      }
    },
    act(fn) {
      const res = fn();
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
        this.tick(1 / 60);
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
    id: `${tel.policy}-1`,
    policy: tel.policy,
    seed: tel.seed,
    level: tel.level,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: tel.level,
    completed: run.state.phase === 'won',
  };
}

function pickTarget(run) {
  const st = run.state;
  const bar = st.barriers.find((b) => b.alive);
  if (bar) return { x: bar.cx, y: bar.cy };
  const e = st.enemies.find((x) => x.alive);
  if (!e) return null;
  return { x: e.cx + e.core.dx, y: e.cy + e.core.dy };
}

// greedy：清障碍 → 打敌人核心，串行打 L1→L2→L3（推进率门槛要求到达第 3 关）
function greedy(seed) {
  const tel = makeTel('greedy', seed);
  let lastRun = null;
  for (const lv of [0, 1, 2]) {
    const run = createRun(lv, { seed: seed + lv });
    tel.bind(run);
    lastRun = run;
    let guard = 6000;
    while (guard-- > 0 && run.state.phase === 'playing') {
      if (run.state.boulders.length === 0) {
        const t = pickTarget(run);
        if (t) {
          tel.act(() => run.aim(t.x, t.y));
          tel.act(() => run.throw());
        }
      }
      tel.tick(1 / 60);
    }
    if (run.state.phase !== 'won') break;
  }
  return finish(tel, lastRun);
}

// random：朝玩家头顶正上方乱投（必然脱靶），验证输入鲁棒与失败路径
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTel('random', seed);
  tel.bind(run);
  const MAX_SEC = 30;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    if (run.state.boulders.length === 0 && run.state.ammoLeft > 0) {
      const tx = 150;
      const ty = 80 + ((seed * 31 + tel.actions * 47) % 240);
      tel.act(() => run.aim(tx, ty));
      tel.act(() => run.throw());
    }
    tel.tick(1 / 60);
  }
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) tel.tick(1 / 60);
  return finish(tel, run);
}

// noinput：只推进时间，测自动推进/死时间基线（时间到 → timeOut 失败）
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTel('noinput', seed);
  tel.bind(run);
  const MAX_SEC = LEVELS[0].timeLimit + 2;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'barbarian-bash',
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
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed}`,
  );
}
