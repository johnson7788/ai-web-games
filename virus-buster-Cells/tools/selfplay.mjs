// VIRUS BUSTER CELLS · 自对弈（Node 无头，直接 import sim）。
// 固定 seed 驱动 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
// greedy：瞄准最低病毒，近身威胁时横移躲避，跨关推进到第 3 关。
// random：随机换位 + 持续开火，验证输入鲁棒与死亡存在性。
// noinput：什么都不做，验证自动开火兜底 + 死亡存在性。
import { createRun, WORLD, STEP } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

const BOT_UPGRADES = { firePower: 2, fireRate: 3, goldValue: 1, shield: 0, nukeStart: 0 };

function makeTracker(policy, seed) {
  return {
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

function drain(tel, run) {
  const evs = run.drainEvents();
  for (const e of evs) {
    tel.seen.add(e.type);
    tel.eventTimes.push(tel.simTime);
    if (e.type === 'win' && tel.firstSuccessAt === null) tel.firstSuccessAt = tel.simTime;
    if (e.type === 'lose') tel.deaths += 1;
  }
  return evs;
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
    id: `${tel.policy}-1`,
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
    levelsReached: tel.maxLevel,
    completed,
  };
}

// ---------------- greedy ----------------
function greedy() {
  const seed = 3;
  const run = createRun(0, { seed, upgrades: BOT_UPGRADES });
  const tel = makeTracker('greedy', seed);
  tel.maxLevel = 1;
  run.setInput(WORLD.WIDTH / 2, true);
  tel.actions += 1;
  tel.firstInputAt = 0;

  const MAX_SEC = 120;
  while (tel.simTime < MAX_SEC) {
    const st = run.state;
    if (st.phase === 'won') {
      tel.maxLevel = Math.max(tel.maxLevel, st.level);
      if (tel.maxLevel >= 3) break; // 推进到第 3 关即达标
      run.nextLevel();
      run.setInput(WORLD.WIDTH / 2, true);
      tel.actions += 1;
      continue;
    }
    if (st.phase === 'gameover') break;

    // 威胁检测：近身病毒或晶体 → 横移躲避
    let threat = null;
    for (const g of st.germs) {
      if (g.y > st.ship.y - 130 && Math.abs(g.x - st.ship.x) < 62) { threat = g; break; }
    }
    if (!threat) {
      for (const c of st.crystals) {
        if (c.y > st.ship.y - 130 && Math.abs(c.x - st.ship.x) < 62) { threat = c; break; }
      }
    }
    let tx;
    if (threat) {
      const dir = threat.x >= st.ship.x ? -1 : 1;
      tx = Math.max(40, Math.min(WORLD.WIDTH - 40, st.ship.x + dir * 150));
    } else {
      // 瞄准最低（最接近飞船）的病毒
      let target = null;
      for (const g of st.germs) if (!target || g.y > target.y) target = g;
      tx = target ? target.x : WORLD.WIDTH / 2;
    }
    run.setInput(tx, true);
    tel.actions += 1;
    run.step(STEP);
    tel.simTime += STEP;
    tel.maxLevel = Math.max(tel.maxLevel, run.state.level);
    drain(tel, run);
  }
  return finish(tel, run, tel.maxLevel >= 3);
}

// ---------------- random ----------------
function random() {
  const seed = 2;
  const run = createRun(0, { seed, upgrades: { firePower: 1, fireRate: 1, goldValue: 1, shield: 0, nukeStart: 0 } });
  const tel = makeTracker('random', seed);
  run.setInput(WORLD.WIDTH / 2, true);
  tel.actions += 1;
  tel.firstInputAt = 0;

  let frame = 0;
  const MAX_SEC = 60;
  while (tel.simTime < MAX_SEC && run.state.phase !== 'gameover') {
    if (frame % 45 === 0) {
      run.setInput(Math.floor(Math.random() * WORLD.WIDTH), true);
      tel.actions += 1;
    }
    run.step(STEP);
    tel.simTime += STEP;
    tel.maxLevel = Math.max(tel.maxLevel, run.state.level);
    drain(tel, run);
    frame += 1;
  }
  return finish(tel, run, run.state.phase === 'gameover');
}

// ---------------- noinput ----------------
function noinput() {
  const seed = 3;
  const run = createRun(0, { seed, upgrades: { firePower: 1, fireRate: 1, goldValue: 1, shield: 0, nukeStart: 0 } });
  const tel = makeTracker('noinput', seed);
  const MAX_SEC = 75;
  while (tel.simTime < MAX_SEC && run.state.phase !== 'gameover') {
    run.step(STEP);
    tel.simTime += STEP;
    tel.maxLevel = Math.max(tel.maxLevel, run.state.level);
    drain(tel, run);
  }
  return finish(tel, run, run.state.phase === 'gameover');
}

const runs = [greedy(), random(), noinput()];
const payload = {
  game: 'virus-buster-Cells',
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
    `${r.id.padEnd(11)} policy=${r.policy.padEnd(8)} dur=${r.durationSec}s ` +
    `firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} ` +
    `actions=${r.actions} deaths=${r.deaths} lv=${r.levelsReached} completed=${r.completed} ` +
    `idle=${r.idleSec}s maxGap=${r.maxEventGapSec}s events=${r.uniqueEvents}`,
  );
}
