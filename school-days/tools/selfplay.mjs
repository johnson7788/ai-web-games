// 山间学堂 · 自对弈（无头，直接 import sim，无 DOM）
// 三策略：greedy（正常打法，串行打到通关/终局）、random（随机排课）、noinput（什么都不做）。
// 产出 tools/fun/autoplay.json（schema 见 playtest-protocol §3）。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32, talentCount } from '../src/game/sim.js';
import { SUBJECTS } from '../config/game.config.js';
import { levelOf, LEVEL_COUNT } from '../config/levels.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

const ATTR_TO_SUBJECT = { grades: 'study', fitness: 'martial', reputation: 'trip', mood: 'rest' };

function gainPerSlot(state, subject) {
  const sub = SUBJECTS[subject];
  if (subject === 'rest') return 0;
  let mult = 1;
  if (levelOf(state.week).feature === 'studyWindow' && subject === 'trip') mult = 2;
  const talentMult = state.week >= 4 ? 2 : 1;
  return Math.round((sub.base + sub.talentBonus * talentCount(subject) * talentMult) * mult);
}

function makeTracker(run, policy, seed, carried) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    level: run.state.level,
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
        if ((e.type === 'weekGoalPass' || e.type === 'win') && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
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
    levelsReached: run.state.week,
    completed: run.state.phase === 'won',
  };
  out._tel = tel;
  return out;
}

// 结算一整周（含事件，选项固定 0）
function resolveWeek(tel, run, optionIndex = 0) {
  let guard = 0;
  while (run.state.phase === 'resolving' && guard++ < 4000) {
    if (run.state.activeEvent) tel.act(() => run.chooseEvent(optionIndex));
    else tel.tick(1 / 60);
  }
}

// ---------------- greedy：冲每周目标 + 补核心两门，尽量休息保体力 ----------------
function greedy(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'greedy', seed);
  let guard = 0;
  while ((run.state.phase === 'planning' || run.state.phase === 'resolving') && guard++ < 20000) {
    if (run.state.phase === 'resolving') { resolveWeek(tel, run); continue; }

    // 排课：先冲本周目标，剩余补核心/休息
    const st = run.state;
    const goal = levelOf(st.week).goal;
    const sub = ATTR_TO_SUBJECT[goal.attr];
    const gain = gainPerSlot(st, sub) || 1;
    let need = goal.attr === 'mood' ? 2 : Math.max(0, Math.ceil((goal.threshold - st.attrs[goal.attr]) / gain));
    need = Math.min(need, st.slotsPerWeek - st.slots.length);

    for (let i = 0; i < need; i += 1) {
      if (!tel.act(() => run.assign(sub)).ok) break;
    }
    // 剩余槽
    let restSlots = st.slotsPerWeek - st.slots.length;
    let safety = 0;
    while (restSlots > 0 && safety++ < 20) {
      const a = st.attrs;
      let pick = 'rest';
      if (st.energy >= 45) {
        if (a.grades < 70) pick = 'study';
        else if (a.fitness < 60) pick = 'martial';
        else if (a.reputation < 55) pick = 'trip';
      }
      if (!tel.act(() => run.assign(pick)).ok) { restSlots -= 1; continue; }
      restSlots -= (levelOf(st.week).feature === 'studyWindow' && pick === 'trip') ? 2 : 1;
    }
    tel.act(() => run.endWeek());
    resolveWeek(tel, run);
  }
  return finish(tel, run);
}

// ---------------- random：随机排课，验证输入鲁棒 ----------------
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const order = ['study', 'martial', 'trip', 'rest'];
  let guard = 0;
  while ((run.state.phase === 'planning' || run.state.phase === 'resolving') && guard++ < 20000) {
    if (run.state.phase === 'resolving') { resolveWeek(tel, run, Math.floor(rng() * 2)); continue; }
    // 随机排 0..5 节课再结束
    const n = Math.floor(rng() * (run.state.slotsPerWeek + 1));
    for (let i = 0; i < n; i += 1) {
      tel.act(() => run.assign(order[Math.floor(rng() * order.length)]));
    }
    tel.act(() => run.endWeek());
    resolveWeek(tel, run, Math.floor(rng() * 2));
  }
  return finish(tel, run);
}

// ---------------- noinput：什么都不做，只推进时间（死时间基线） ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const SEC = 90;
  for (let i = 0; i < SEC * 60; i += 1) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'school-days',
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
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed}`,
  );
}
