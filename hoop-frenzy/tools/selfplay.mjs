// HOOP FRENZY · 自对弈（bot 遥测）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成一局并写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
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
    level: run.state.stage,
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
        this.seen.add(e);
        this.eventTimes.push(this.simTime);
        if ((e === 'swish' || e === 'bank') && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e === 'lifeLost') this.deaths += 1;
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
    id: tel.id,
    policy: tel.policy,
    seed: tel.seed,
    level: run.state.stage,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.stage,
    completed: run.state.phase === 'won',
  };
}

// ---------------- greedy：卡准理想力量出手，追求空心连击，直到通关 ----------------
function greedy(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'greedy', seed);
  let guard = 0;
  while ((run.state.phase === 'aiming' || run.state.phase === 'recover') && tel.simTime < 60) {
    if (run.state.phase === 'aiming') {
      if (Math.abs(run.state.power - run.idealPower()) < 0.03) {
        tel.act(() => run.shoot());
      } else {
        tel.tick(1 / 60);
      }
    } else {
      tel.tick(1 / 60);
    }
    if (++guard > 20000) break;
  }
  return finish(tel, run);
}

// ---------------- random：随机力量出手，偶尔「手抖」发呆到时钟耗尽（保证有失败） ----------------
function random(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let choke = 0;
  let guard = 0;
  while ((run.state.phase === 'aiming' || run.state.phase === 'recover') && tel.simTime < 45) {
    if (run.state.phase === 'aiming') {
      if (choke % 4 === 3) {
        choke += 1;
        // 手抖：发呆直到倒计时耗尽（扣 1 命）
        let freeze = run.state.clock + 0.1;
        while (freeze > 0 && run.state.phase === 'aiming') {
          tel.tick(1 / 60);
          freeze -= 1 / 60;
        }
      } else {
        choke += 1;
        run.state.power = rng();
        tel.act(() => run.shoot());
      }
    } else {
      tel.tick(1 / 60);
    }
    if (++guard > 20000) break;
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测死时间/失败基线 ----------------
function noinput(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'noinput', seed);
  while (run.state.phase !== 'lost' && tel.simTime < 30) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'hoop-frenzy',
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
    `actions=${r.actions} deaths=${r.deaths} stage=${r.levelsReached} completed=${r.completed}`,
  );
}
