// 山间学堂 · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：12 周日程制校园经营——课时分配、周结算、随机事件、学期末大考放榜。
// 依赖：config/levels.js（12 周）、config/events.js（事件表）、config/game.config.js（数值）。
// 随机：注入 seed 的 mulberry32，可复现。

import { LEVEL_COUNT, levelOf } from '../../config/levels.js';
import { RANDOM_POOL, eventById } from '../../config/events.js';
import { GAME, SUBJECTS, SUBJECT_ORDER, STUDENTS } from '../../config/game.config.js';

export const ATTR_KEYS = ['grades', 'fitness', 'mood', 'reputation'];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function talentCount(subject) {
  return STUDENTS.filter((s) => s.talent === subject).length;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function cloneAttrs(attrs) {
  return { ...attrs };
}

// 从 week 里取出本周特性规则是否生效
function featOn(week, feature) {
  return levelOf(week).feature === feature;
}

// 构造某周的事件队列（seeded；第 1 周无事件）
function buildEventQueue(week, rng) {
  if (week === 1) return [];
  const scripted = levelOf(week).events || [];
  if (scripted.length) return scripted.map((id) => eventById(id)).filter(Boolean);
  if (week >= LEVEL_COUNT) return [];
  // 无剧情事件的周：从池子 seeded 抽 0-2 个
  const n = Math.floor(rng() * 3); // 0..2
  const pool = [...RANDOM_POOL];
  const picked = [];
  for (let i = 0; i < n && pool.length; i += 1) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

// 学生大考放榜：按学校属性 + 天赋 + seeded 抖动，判断谁上榜
function buildRanking(attrs, rng) {
  return STUDENTS.map((s) => {
    let base = attrs.grades * 0.4 + attrs.fitness * 0.3 + attrs.mood * 0.15 + attrs.reputation * 0.15;
    if (s.talent === 'study') base += attrs.grades * 0.05;
    else if (s.talent === 'martial') base += attrs.fitness * 0.05;
    else if (s.talent === 'trip') base += attrs.reputation * 0.05;
    const jitter = (rng() - 0.5) * 10;
    const score = Math.round(clamp(base + jitter, 0, 100));
    return { id: s.id, name: s.name, talent: s.talent, score, passed: score >= 55 };
  });
}

// ---------------------------------------------------------------- createRun
export function createRun(levelIndex = 0, opts = {}) {
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);
  const startAttrs = { ...GAME.START_ATTRS };

  const state = {
    level: 1,
    week: 1,
    phase: 'planning', // planning | resolving | won | lost
    coins: GAME.START_COINS,
    energy: GAME.START_ENERGY,
    energyMax: GAME.ENERGY_MAX,
    attrs: startAttrs,
    slots: [],             // 本周已排课时（subject id 数组）
    slotsPerWeek: GAME.SLOTS_PER_WEEK,
    eventQueue: buildEventQueue(1, rng),
    activeEvent: null,     // { ...event, options }，等待 chooseEvent
    resolving: { stage: 'slots', slotIdx: 0, slotT: 0, eventIdx: 0 },
    stars: 0,
    weekStars: [],         // 每周 0/1 星
    lastResult: null,      // 本周结算摘要
    result: null,          // 学期末结果
    seed,
  };

  const run = {
    state,
    _rng: rng,
    _events: [],
    _clock: 0,

    step(dt) {
      const s = this.state;
      if (s.phase !== 'resolving') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      this._clock += dt;

      if (s.activeEvent) return; // 等 chooseEvent

      const r = s.resolving;

      if (r.stage === 'slots') {
        r.slotT += dt;
        while (r.slotT >= GAME.SLOT_DURATION && r.slotIdx < s.slots.length) {
          r.slotT -= GAME.SLOT_DURATION;
          this._applySubject(s.slots[r.slotIdx]);
          this._emit({ type: 'classApplied', subject: s.slots[r.slotIdx], slotIdx: r.slotIdx });
          r.slotIdx += 1;
        }
        if (r.slotIdx >= s.slots.length) {
          this._settleWeek();
          r.stage = 'events';
        }
      } else if (r.stage === 'events') {
        if (r.eventIdx < s.eventQueue.length) {
          const ev = s.eventQueue[r.eventIdx];
          r.eventIdx += 1;
          s.activeEvent = ev;
          this._emit({ type: 'eventStart', event: ev.id });
        } else {
          r.stage = 'finalize';
        }
      } else if (r.stage === 'finalize') {
        this._finalize();
      }
    },

    // ---- 分配课时 ----
    assign(subject) {
      const s = this.state;
      if (s.phase !== 'planning') return { ok: false, reason: 'phase' };
      const sub = SUBJECTS[subject];
      if (!sub) return { ok: false, reason: 'badSubject' };

      const isTripWindow = featOn(s.week, 'studyWindow') && subject === 'trip';
      const needSlots = isTripWindow ? 2 : 1;
      if (s.slots.length + needSlots > s.slotsPerWeek) return { ok: false, reason: 'noSlots' };

      const energyCost = sub.energyCost * needSlots;
      const coinCost = sub.coinCost * needSlots;
      if (s.energy < energyCost) return { ok: false, reason: 'noEnergy' };
      if (s.coins < coinCost) return { ok: false, reason: 'noCoins' };

      s.energy -= energyCost;
      s.coins -= coinCost;
      for (let i = 0; i < needSlots; i += 1) s.slots.push(subject);
      this._emit({ type: 'assign', subject, slots: s.slots.length });
      return { ok: true, subject, slots: s.slots.length };
    },

    // ---- 撤销一个已排课时（退回体力/金币） ----
    unassign(index) {
      const s = this.state;
      if (s.phase !== 'planning') return { ok: false, reason: 'phase' };
      if (index < 0 || index >= s.slots.length) return { ok: false, reason: 'bounds' };
      const subject = s.slots[index];
      const sub = SUBJECTS[subject];
      const needSlots = (featOn(s.week, 'studyWindow') && subject === 'trip') ? 2 : 1;
      // 游学窗口的 trip 占两个连续槽；撤销任意一个都整组退回
      if (needSlots === 2) {
        // 找到该组两个槽的起点
        const firstTrip = s.slots.indexOf(subject);
        if (firstTrip !== -1 && (index === firstTrip || index === firstTrip + 1)) {
          s.slots.splice(firstTrip, 2);
          s.energy += sub.energyCost * 2;
          s.coins += sub.coinCost * 2;
        } else {
          s.slots.splice(index, 1);
        }
      } else {
        s.slots.splice(index, 1);
        s.energy += sub.energyCost;
        s.coins += sub.coinCost;
      }
      this._emit({ type: 'unassign', subject, slots: s.slots.length });
      return { ok: true, slots: s.slots.length };
    },

    // ---- 结束本周，进入结算 ----
    endWeek() {
      const s = this.state;
      if (s.phase !== 'planning') return { ok: false, reason: 'phase' };
      s.phase = 'resolving';
      s.resolving = { stage: 'slots', slotIdx: 0, slotT: 0, eventIdx: 0 };
      s.activeEvent = null;
      this._emit({ type: 'endWeek', week: s.week });
      return { ok: true };
    },

    // ---- 处理当前事件（选择第 optionIndex 个选项） ----
    chooseEvent(optionIndex) {
      const s = this.state;
      if (!s.activeEvent) return { ok: false, reason: 'noEvent' };
      const ev = s.activeEvent;
      const opt = ev.options[optionIndex];
      if (!opt) return { ok: false, reason: 'badOption' };
      this._applyEffects(opt.effects || {});
      s.activeEvent = null;
      this._emit({ type: 'eventResolved', event: ev.id, option: optionIndex });
      return { ok: true };
    },

    getHud() {
      const s = this.state;
      const lv = levelOf(s.week);
      return {
        week: s.week,
        phase: s.phase,
        coins: s.coins,
        energy: s.energy,
        energyMax: s.energyMax,
        attrs: cloneAttrs(s.attrs),
        slots: [...s.slots],
        slotsPerWeek: s.slotsPerWeek,
        goal: lv.goal,
        scene: lv.scene,
        feature: lv.feature,
        eventActive: !!s.activeEvent,
        stars: s.stars,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _applyEffects(effects) {
      const s = this.state;
      if (typeof effects.coins === 'number') s.coins = clamp(s.coins + effects.coins, 0, 1e9);
      if (typeof effects.energy === 'number') s.energy = clamp(s.energy + effects.energy, 0, s.energyMax);
      if (typeof effects.grades === 'number') s.attrs.grades = clamp(s.attrs.grades + effects.grades, GAME.ATTR_MIN, GAME.ATTR_MAX);
      if (typeof effects.fitness === 'number') s.attrs.fitness = clamp(s.attrs.fitness + effects.fitness, GAME.ATTR_MIN, GAME.ATTR_MAX);
      if (typeof effects.mood === 'number') s.attrs.mood = clamp(s.attrs.mood + effects.mood, GAME.ATTR_MIN, GAME.ATTR_MAX);
      if (typeof effects.reputation === 'number') s.attrs.reputation = clamp(s.attrs.reputation + effects.reputation, GAME.ATTR_MIN, GAME.ATTR_MAX);
    },

    _applySubject(subject) {
      const s = this.state;
      const sub = SUBJECTS[subject];
      if (subject === 'rest') {
        s.energy = clamp(s.energy + (sub.energyRegen || 0), 0, s.energyMax);
        s.attrs.mood = clamp(s.attrs.mood + sub.moodDelta, GAME.ATTR_MIN, GAME.ATTR_MAX);
        return;
      }
      let mult = 1;
      if (featOn(s.week, 'studyWindow') && subject === 'trip') mult = 2;
      if (featOn(s.week, 'storm') && (subject === 'martial' || subject === 'trip')) {
        mult *= this._rng() < 0.5 ? 1.5 : 0.5;
      }
      const talentMult = s.week >= 4 ? 2 : 1; // 第 4 周起天赋加成翻倍
      const gain = Math.round((sub.base + sub.talentBonus * talentCount(subject) * talentMult) * mult);
      s.attrs[sub.attr] = clamp(s.attrs[sub.attr] + gain, GAME.ATTR_MIN, GAME.ATTR_MAX);
      s.attrs.mood = clamp(s.attrs.mood + sub.moodDelta, GAME.ATTR_MIN, GAME.ATTR_MAX);
    },

    _settleWeek() {
      const s = this.state;
      const lv = levelOf(s.week);

      // 每周自然恢复体力
      s.energy = clamp(s.energy + GAME.WEEKLY_ENERGY_REGEN, 0, s.energyMax);
      // 体力过低 → 心情惩罚
      if (s.energy < GAME.LOW_ENERGY_THRESHOLD) {
        s.attrs.mood = clamp(s.attrs.mood - GAME.LOW_ENERGY_MOOD_PENALTY, GAME.ATTR_MIN, GAME.ATTR_MAX);
        this._emit({ type: 'exhausted', energy: s.energy });
      }

      // 第 11 周模拟考
      if (featOn(s.week, 'mockExam')) {
        const targets = GAME.MOCK_TARGETS;
        const mockPass = ATTR_KEYS.every((k) => s.attrs[k] >= targets[k]);
        if (mockPass) s.attrs.mood = clamp(s.attrs.mood + 5, GAME.ATTR_MIN, GAME.ATTR_MAX);
        this._emit({ type: 'mockExam', passed: mockPass, attrs: cloneAttrs(s.attrs) });
      }

      // 本周目标判定
      const goal = lv.goal;
      const value = s.attrs[goal.attr];
      const passed = value >= goal.threshold;
      let starsEarned = 0;
      if (passed) {
        starsEarned = 1;
        s.stars += 1;
        s.coins = clamp(s.coins + GAME.GOAL_COIN_REWARD, 0, 1e9);
        s.attrs.mood = clamp(s.attrs.mood + 3, GAME.ATTR_MIN, GAME.ATTR_MAX);
        this._emit({ type: 'weekGoalPass', week: s.week, attr: goal.attr, value });
      } else {
        s.attrs.mood = clamp(s.attrs.mood - 3, GAME.ATTR_MIN, GAME.ATTR_MAX);
        this._emit({ type: 'weekGoalFail', week: s.week, attr: goal.attr, value, threshold: goal.threshold });
      }
      s.weekStars.push(starsEarned);
      s.lastResult = { week: s.week, goal, value, passed, starsEarned };
      this._emit({ type: 'weekSettled', week: s.week, passed, stars: s.stars });
    },

    _finalize() {
      const s = this.state;
      if (s.week >= LEVEL_COUNT) {
        this._finalExam();
        return;
      }
      const nextWeek = s.week + 1;
      this._applyWeekStartFeatures(nextWeek);
      s.week = nextWeek;
      s.level = nextWeek;
      s.slots = [];
      s.activeEvent = null;
      s.eventQueue = buildEventQueue(nextWeek, this._rng);
      s.phase = 'planning';
      this._emit({ type: 'weekStart', week: s.week });
    },

    _applyWeekStartFeatures(week) {
      const s = this.state;
      const lv = levelOf(week);
      if (lv.feature === 'energyCap') {
        s.energyMax += GAME.ENERGY_MAX_UP;
        s.energy = clamp(s.energy + GAME.ENERGY_MAX_UP, 0, s.energyMax);
      } else if (lv.feature === 'cram') {
        s.coins = clamp(s.coins + 200, 0, 1e9); // 村学补助
      }
    },

    _finalExam() {
      const s = this.state;
      const targets = GAME.FINAL_TARGETS;
      const all4 = ATTR_KEYS.every((k) => s.attrs[k] >= targets[k]);
      const corePass = GAME.CORE_EXAM.every((k) => s.attrs[k] >= targets[k]);
      const won = corePass;
      const stars = won ? (all4 ? 3 : 2) : (ATTR_KEYS.filter((k) => s.attrs[k] >= targets[k]).length);
      const ranking = buildRanking(s.attrs, this._rng);
      s.result = {
        won,
        all4,
        corePass,
        stars,
        attrs: cloneAttrs(s.attrs),
        targets: { ...targets },
        ranking,
        totalStars: s.stars,
      };
      s.phase = won ? 'won' : 'lost';
      this._emit({ type: won ? 'win' : 'lose', stars, all4, attrs: cloneAttrs(s.attrs) });
    },
  };

  run._emit({ type: 'start', week: 1 });
  return run;
}

// 兼容骨架别名
export function createSim() {
  return createRun(0, { seed: 1 });
}

export { SUBJECT_ORDER, STUDENTS, SUBJECTS, ATTR_KEYS as ATTRS };
