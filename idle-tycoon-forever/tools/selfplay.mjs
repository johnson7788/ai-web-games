// IDLE TYCOON FOREVER · 自对弈（无头，纯 sim，无 DOM）。
// greedy / random / noinput 三策略 → tools/fun/autoplay.json（schema 见 playtest-protocol §3）。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { DISTRICTS, MAX_LV } from '../src/game/data.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function makeTracker(run, policy, seed, carried) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    simTime: (carried && carried.simTime) ?? 0,
    firstInputAt: (carried && carried.firstInputAt) ?? null,
    firstSuccessAt: (carried && carried.firstSuccessAt) ?? null,
    deaths: (carried && carried.deaths) ?? 0,
    actions: (carried && carried.actions) ?? 0,
    seen: new Set((carried && [...carried.seen]) || []),
    eventTimes: (carried && [...carried.eventTimes]) || [0],
    tick(dt) {
      run.step(dt);
      this.simTime += dt;
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if ((e.type === 'win' || e.type === 'districtClear') && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
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

function finish(tel, run, levelsReached) {
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
    levelsReached,
    completed: run.state.phase === 'idle' && run.state.rivals.every((r) => r.hp <= 0),
  };
}

// 投资：用尽扩张令 → 现金升级 → 装备最优部门 → 垄断。返回是否发生了动作。
function invest(run, tel) {
  let acted = false;
  while (run.state.player.lv < MAX_LV) {
    const r = tel.act(() => run.useChip(1));
    if (!r.ok) break;
    acted = true;
  }
  while (run.state.player.lv < MAX_LV) {
    const r = tel.act(() => run.levelUpViaCash());
    if (!r.ok) break;
    acted = true;
  }
  const p = run.state.player;
  let bestIdx = -1;
  let bestScore = -1;
  p.backpack.forEach((b, i) => {
    if (b.type !== 'dept') return;
    const score = (b.att || 0) + (b.def || 0) + (b.hp || 0);
    const cur = p.equip[b.slot];
    const curScore = cur ? (cur.att || 0) + (cur.def || 0) + (cur.hp || 0) : -1;
    if (score > curScore && score > bestScore) { bestScore = score; bestIdx = i; }
  });
  if (bestIdx >= 0 && tel.act(() => run.equipDept(bestIdx)).ok) acted = true;
  if (tel.act(() => run.monopolyUpgrade()).ok) acted = true;
  return acted;
}

function greedy(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  let maxReached = 1;
  for (let district = 0; district < 3; district += 1) {
    if (district > 0) {
      // 升级到解锁
      let guard = 0;
      while (run.state.player.lv < DISTRICTS[district].unlockLv && guard++ < 200) {
        if (!invest(run, tel)) tel.tick(1 / 60);
      }
      const res = run.enterDistrict(district);
      if (!res.ok) break;
    }
    maxReached = Math.max(maxReached, run.state.district + 1);
    // 先打普通对手，Boss 留到最后
    const order = [...Array(run.state.rivals.length).keys()].sort(
      (a, b) => (run.state.rivals[a].boss ? 1 : 0) - (run.state.rivals[b].boss ? 1 : 0),
    );
    for (const idx of order) {
      if (run.state.rivals[idx].hp <= 0) continue;
      let guard = 0;
      while (run.state.rivals[idx].hp > 0 && guard++ < 2000) {
        if (tel.simTime > 400) break;
        if (run.state.phase === 'idle') {
          const r = tel.act(() => run.pickRival(idx));
          if (!r.ok) break;
        } else {
          tel.tick(1 / 60);
        }
      }
      invest(run, tel);
      if (tel.simTime > 400) break;
    }
    if (tel.simTime > 400) break;
  }
  return finish(tel, run, maxReached);
}

function random(seed) {
  const s = seed * 7919 + 13;
  const run = createRun({ seed: s });
  const tel = makeTracker(run, 'random', s);
  const rng = mulberry32(s);
  const MAX_SEC = 120;
  while (tel.simTime < MAX_SEC) {
    if (run.state.phase === 'idle') {
      const alive = run.state.rivals.map((r, i) => ({ r, i })).filter((x) => x.r.hp > 0);
      if (alive.length && rng() < 0.9) {
        tel.act(() => run.pickRival(alive[Math.floor(rng() * alive.length)].i));
      }
      if (rng() < 0.25) tel.act(() => run.useChip(1));
      if (rng() < 0.15) tel.act(() => run.levelUpViaCash());
      if (rng() < 0.15) tel.act(() => run.monopolyUpgrade());
      tel.tick(1 / 60);
    } else {
      tel.tick(1 / 60);
    }
  }
  return finish(tel, run, run.state.district + 1);
}

function noinput(seed) {
  const s = seed * 31 + 7;
  const run = createRun({ seed: s });
  const tel = makeTracker(run, 'noinput', s);
  const MAX_SEC = 60;
  while (tel.simTime < MAX_SEC) tel.tick(1 / 60);
  return finish(tel, run, run.state.district + 1);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'idle-tycoon-forever',
  genre: 'sim',
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
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} levels=${r.levelsReached}`,
  );
}
