// SNOWMAN FACTORY · 自对弈（无头 Node，直接 import sim）
// greedy / random / noinput 三策略，每局结束写 tools/fun/autoplay.json。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32 } from '../src/game/sim.js';
import { BALANCE, LAYOUT } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function beltSpeed(level) {
  return BALANCE.beltSpeedBase + (level - 1) * BALANCE.beltSpeedPerLevel;
}

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
        if (e.type === 'catch' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
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
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.level,
    completed: false,
  };
}

// ---------------- greedy：预测落点，只在蛋筒将进入接住区时出手 ----------------
function greedy(seed) {
  const run = createRun({ seed });
  run.start('classic');
  const tel = makeTracker(run, 'greedy', seed);
  const MAX_STEPS = 75 * 60;
  let lastLaunchAt = -10;

  for (let i = 0; i < MAX_STEPS; i += 1) {
    const s = run.state;
    if (s.phase !== 'playing') break;

    if (!s.scoop) {
      const bs = beltSpeed(s.level);
      const lead = bs * BALANCE.dropTime;
      let bestCone = null;
      let bd = Infinity;
      let bestRock = null;
      let rd = Infinity;
      let anyCone = false;
      for (const it of s.items) {
        if (it.state !== 'sliding') continue;
        if (it.kind === 'cone' && !it.topped) anyCone = true;
        const landX = it.x + lead;
        const d = Math.abs(landX - LAYOUT.SNOWMAN_X);
        if (it.kind === 'cone' && !it.topped) {
          if (d < bd) { bd = d; bestCone = it; }
        } else if (it.kind === 'rock') {
          if (d < rd) { rd = d; bestRock = it; }
        }
      }
      // 精确命中窗口（收紧到 0.55 倍，减少误判），且落点更近的是蛋筒不是岩石
      if (bestCone && bd <= LAYOUT.CATCH_HALF * 0.55 && (!bestRock || rd > bd)) {
        tel.act(() => run.launch());
        lastLaunchAt = tel.simTime;
      } else if (anyCone && tel.simTime - lastLaunchAt > 4) {
        // 兜底：有蛋筒在传送带但迟迟没进窗口，也出手一次保持节奏
        tel.act(() => run.launch());
        lastLaunchAt = tel.simTime;
      }
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- random：高频乱点，验证输入鲁棒 ----------------
function random(seed) {
  const run = createRun({ seed });
  run.start('classic');
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 13 + 3);
  const MAX_SEC = 90;
  let next = 0;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    if (tel.simTime >= next) {
      next = tel.simTime + 0.3 + rng() * 0.6;
      tel.act(() => run.launch());
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- noinput：只推时间，靠 auto-launch 兜底触发死亡 ----------------
function noinput(seed) {
  const run = createRun({ seed });
  run.start('classic');
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 60;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(5)];
const payload = {
  game: 'snowman-factory',
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
    `actions=${r.actions} deaths=${r.deaths} level=${r.levelsReached} events=${r.uniqueEvents}`,
  );
}
