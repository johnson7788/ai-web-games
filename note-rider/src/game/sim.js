// NOTE RIDER · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：逻辑节拍时钟（seeded 可复现，验收不依赖音频）、音符谱面生成、
//       判定（Perfect/Great/Good/Miss/Dodge）、怪物血量与反击、技能与能量、
//       和弦斩签名瞬间、事件表、胜负。
// 依赖：config/levels.js + config/game.config.js。
// 契约：docs/README.md §3（createRun API / state 形状 / 事件表）。
// 随机：注入 seed 的 mulberry32，可复现。

import { LEVELS } from '../../config/levels.js';
import { GAME, SKILLS } from '../../config/game.config.js';

// ------------------------------------------------------------------ RNG
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = GAME.HIT_WINDOWS;
const GRADES = GAME.GRADES;
const CHORD_STREAK = GAME.CHORD_STREAK;
const ENERGY_MAX = GAME.ENERGY_MAX;
const SWITCH_COOLDOWN = GAME.SWITCH_COOLDOWN;

// ------------------------------------------------------------------ 谱面生成（deterministic）
function generateChart(level, seed) {
  const rng = mulberry32(seed * 2654435761 + level.index);
  const beat = 60 / level.bpm;
  const notes = [];
  let id = 0;
  let t = level.leadTime + 1;

  // 以整拍为最小步进；noteDensity 决定每拍是否放 note。
  // 蓄斩（hold）时长 = 0.8 拍，短于一拍步进 → 不会与下一 note 重叠，保证可被稳定判定。
  while (t < level.chartDuration - 3) {
    if (rng() < level.noteDensity) {
      const lane = level.lanes === 1 ? 0 : (rng() < 0.5 ? 0 : 1);
      let type = 'tap';
      const f = level.features;
      const roll = rng();
      if (f.hold && roll < 0.16) type = 'hold';
      else if (f.red && roll < 0.3) type = 'red';
      else if (f.double && roll < 0.42) type = 'double';
      const dur = type === 'hold' ? beat * 0.8 : 0;
      notes.push({
        id: id++,
        lane,
        type,
        start: round2(t),
        end: round2(type === 'hold' ? t + dur : t),
        hp: 1,
        damage: level.noteDamage,
        isBoss: false,
        resolved: false,
        spawned: false,
      });
    }
    t += beat;
  }

  // Boss：末段一只高血量蓄斩弦魔（hold，需蓄满整段伤害）
  const bossStart = round2(level.chartDuration - 2.6);
  const bossEnd = round2(level.chartDuration - 0.6);
  notes.push({
    id: id++,
    lane: 0,
    type: 'hold',
    start: bossStart,
    end: bossEnd,
    hp: level.bossHp,
    damage: level.bossDamage,
    isBoss: true,
    resolved: false,
    spawned: false,
  });

  return notes.sort((a, b) => a.start - b.start);
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

// ------------------------------------------------------------------ createRun
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const chart = generateChart(level, seed);

  const state = {
    level: level.index,
    phase: 'playing', // 'playing' | 'won' | 'lost'
    scene: level.scene,
    lanes: level.lanes,
    lane: 0,
    beatClock: 0,
    bpm: level.bpm,
    speedMult: 1,          // 变速乐章：中途视觉加速（不影响判定）
    chartDuration: level.chartDuration,
    leadTime: level.leadTime,
    notes: chart,
    notesTotal: chart.length,
    notesHit: 0,
    notesMissed: 0,
    score: 0,
    combo: 0,
    comboMax: 0,
    perfectStreak: 0,
    perfect: 0,
    great: 0,
    good: 0,
    hp: GAME.MAX_HP,
    maxHp: GAME.MAX_HP,
    energy: 0,
    energyMax: ENERGY_MAX,
    result: null,
    bossDefeated: false,
  };

  const run = {
    state,
    _level: level,
    _rng: mulberry32(seed),
    _events: [],
    _beatAccum: 0,
    _beatIdx: 0,
    _holding: null,       // 正在蓄斩的 note
    _switchReadyAt: 0,
    _shieldUntil: -1,
    _burstUntil: -1,
    _burstLeft: 0,
    _lifeUntil: -1,
    _cooldownUntil: {},

    // ---- 时间推进
    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 0.5) dt = 0.5; // 防大跳帧
      s.beatClock += dt;

      // 变速乐章：后半程视觉加速
      if (this._level.tempoShift && s.beatClock >= s.chartDuration * 0.5) {
        s.speedMult = 1.5;
      }

      // 拍点事件（细粒度遥测，保证事件密度）
      const beatLen = 60 / s.bpm;
      this._beatAccum += dt;
      while (this._beatAccum >= beatLen) {
        this._beatAccum -= beatLen;
        this._beatIdx += 1;
        this._emit({ type: 'beat', beat: this._beatIdx });
      }

      // 谱面进入视窗（approach）→ noteSpawn
      for (const n of s.notes) {
        if (!n.spawned && !n.resolved && s.beatClock >= n.start - this._approachWindow()) {
          n.spawned = true;
          this._emit({ type: 'noteSpawn', id: n.id, lane: n.lane, kind: n.type, start: n.start, isBoss: n.isBoss });
        }
      }

      // 蓄斩完成
      if (this._holding) {
        if (s.beatClock >= this._holding.end) {
          this._defeatHold(this._holding, 'full');
        }
      }

      // 漏击 / 闪避结算
      for (const n of s.notes) {
        if (n.resolved) continue;
        if (n.type === 'red') {
          if (s.beatClock > n.start + W.good) {
            n.resolved = true;
            this._emit({ type: 'dodge', id: n.id, lane: n.lane });
          }
        } else if (n.type === 'hold') {
          if (s.beatClock > n.end + W.good) {
            this._missNote(n);
          }
        } else {
          if (s.beatClock > n.start + W.good) {
            this._missNote(n);
          }
        }
      }

      // 胜利：曲终且血 > 0
      if (s.beatClock >= s.chartDuration + 1.0 && s.hp > 0) {
        this._win();
      }
    },

    _approachWindow() {
      // note 提前多少秒进入视窗（可被变速乐章影响渲染，这里保守给足）
      return 4.5;
    },

    // ---- 输入：斩击（按下）
    slash() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      this._emit({ type: 'slash', lane: s.lane });

      let cand = null;
      let bestDt = Infinity;
      for (const n of s.notes) {
        if (n.resolved || n.lane !== s.lane) continue;
        const dt = s.beatClock - n.start;
        if (Math.abs(dt) > W.good) continue;
        // 红色反击音：斩错 → 被反打（优先于正常 note，因谱面间隔保证不重叠）
        if (n.type === 'red') {
          this._redHit(n);
          return { ok: true, hit: false, red: true };
        }
        if (Math.abs(dt) < bestDt) {
          bestDt = Math.abs(dt);
          cand = n;
        }
      }

      if (!cand) return { ok: true, hit: false };

      if (cand.type === 'hold') {
        // 蓄斩：按下即开始蓄力
        this._holding = cand;
        this._emit({ type: 'holdStart', id: cand.id, lane: cand.lane });
        return { ok: true, hit: true, hold: true };
      }

      // tap / double
      this._hitNote(cand, this._gradeOf(s.beatClock - cand.start));
      return { ok: true, hit: true };
    },

    // ---- 输入：松开（用于蓄斩收尾）
    release() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (!this._holding) return { ok: true, released: false };
      const note = this._holding;
      const progress = (s.beatClock - note.start) / Math.max(0.001, note.end - note.start);
      this._holding = null;
      if (progress >= 0.88) {
        this._defeatHold(note, 'full');
      } else {
        this._missNote(note);
      }
      return { ok: true, released: true };
    },

    // ---- 输入：换轨
    switchLane(target) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.lanes < 2) return { ok: false, reason: 'single' };
      if (s.beatClock < this._switchReadyAt) return { ok: false, reason: 'cooldown' };
      const next = target === 'up' || target === 0 ? 0 : target === 'down' || target === 1 ? 1 : (1 - s.lane);
      if (next === s.lane) return { ok: true, lane: s.lane, changed: false };
      s.lane = next;
      this._switchReadyAt = s.beatClock + SWITCH_COOLDOWN;
      this._emit({ type: 'switch', lane: s.lane });
      return { ok: true, lane: s.lane, changed: true };
    },

    // ---- 输入：技能
    useSkill(id) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      const skill = SKILLS[id];
      if (!skill) return { ok: false, reason: 'unknown' };
      if (s.energy < skill.cost) return { ok: false, reason: 'noEnergy' };
      if ((this._cooldownUntil[id] || 0) > s.beatClock) return { ok: false, reason: 'cooldown' };
      s.energy -= skill.cost;
      this._cooldownUntil[id] = s.beatClock + skill.cooldown;

      if (id === 'shield') this._shieldUntil = s.beatClock + skill.duration;
      if (id === 'burst') { this._burstUntil = s.beatClock + skill.duration; this._burstLeft = skill.hits; }
      if (id === 'lifesteal') this._lifeUntil = s.beatClock + skill.duration;
      if (id === 'heal') {
        s.hp = Math.min(s.maxHp, s.hp + skill.amount);
        this._emit({ type: 'heal', amount: skill.amount, hp: s.hp });
      }
      this._emit({ type: 'skill', id });
      return { ok: true, id };
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        hp: s.hp,
        maxHp: s.maxHp,
        score: s.score,
        combo: s.combo,
        comboMax: s.comboMax,
        energy: s.energy,
        energyMax: s.energyMax,
        lane: s.lane,
        lanes: s.lanes,
        beatClock: s.beatClock,
        chartDuration: s.chartDuration,
        notesHit: s.notesHit,
        notesMissed: s.notesMissed,
        notesTotal: s.notesTotal,
        bossDefeated: s.bossDefeated,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _gradeOf(dt) {
      const a = Math.abs(dt);
      if (a <= W.perfect) return 'perfect';
      if (a <= W.great) return 'great';
      return 'good';
    },

    _hitNote(note, grade) {
      const s = this.state;
      let dmg = GRADES[grade].dmg;
      if (s.beatClock < this._burstUntil && this._burstLeft > 0) {
        dmg *= 2;
        this._burstLeft -= 1;
      }
      s.score += GRADES[grade].score;
      s.combo += 1;
      s.comboMax = Math.max(s.comboMax, s.combo);
      s[grade] += 1;
      if (grade === 'perfect') {
        s.perfectStreak += 1;
        s.energy = Math.min(s.energyMax, s.energy + 1);
        if (s.beatClock < this._lifeUntil) {
          s.hp = Math.min(s.maxHp, s.hp + 5);
          this._emit({ type: 'lifesteal', amount: 5, hp: s.hp });
        }
      } else {
        s.perfectStreak = 0;
      }

      note.hp -= dmg;
      this._emit({ type: 'hit', id: note.id, lane: note.lane, grade, dmg, score: GRADES[grade].score });
      this._emit({ type: grade, id: note.id, lane: note.lane });

      if (note.hp <= 0) {
        note.resolved = true;
        s.notesHit += 1;
        if (note.isBoss) s.bossDefeated = true;
        this._emit({ type: 'kill', id: note.id, lane: note.lane, isBoss: note.isBoss });
        if (note.isBoss) this._emit({ type: 'bossDefeated', id: note.id });
      }

      // 签名瞬间：连续 Perfect 触发「和弦斩」
      if (s.perfectStreak >= CHORD_STREAK) {
        s.perfectStreak = 0;
        s.score += 50;
        this._emit({ type: 'chordSlash', lane: s.lane, score: 50 });
      }
    },

    _defeatHold(note, kind) {
      const s = this.state;
      if (note.resolved) { this._holding = null; return; }
      // 蓄满 = 全额伤害（含爆发加成）
      let dmg = note.hp;
      if (kind === 'full' && s.beatClock < this._burstUntil && this._burstLeft > 0) {
        dmg *= 2;
        this._burstLeft -= 1;
      }
      note.hp -= dmg;
      this._holding = null;
      if (note.hp <= 0) {
        note.resolved = true;
        s.notesHit += 1;
        s.combo += 1;
        s.comboMax = Math.max(s.comboMax, s.combo);
        s.score += 30;
        s.perfectStreak += 1;
        s.energy = Math.min(s.energyMax, s.energy + 1);
        if (note.isBoss) s.bossDefeated = true;
        this._emit({ type: 'holdComplete', id: note.id, lane: note.lane, isBoss: note.isBoss });
        this._emit({ type: 'kill', id: note.id, lane: note.lane, isBoss: note.isBoss });
        if (note.isBoss) this._emit({ type: 'bossDefeated', id: note.id });
      }
    },

    _missNote(note) {
      const s = this.state;
      if (note.resolved) return;
      note.resolved = true;
      s.notesMissed += 1;
      s.combo = 0;
      s.perfectStreak = 0;
      this._emit({ type: 'miss', id: note.id, lane: note.lane, isBoss: note.isBoss });
      this._damagePlayer(note.damage, 'miss');
    },

    _redHit(note) {
      const s = this.state;
      note.resolved = true;
      s.combo = 0;
      s.perfectStreak = 0;
      this._emit({ type: 'redHit', id: note.id, lane: note.lane });
      this._damagePlayer(note.damage, 'redHit');
    },

    _damagePlayer(amount, source) {
      const s = this.state;
      if (s.beatClock < this._shieldUntil) {
        this._emit({ type: 'block', amount, source });
        return;
      }
      s.hp = Math.max(0, s.hp - amount);
      this._emit({ type: 'hurt', amount, source, hp: s.hp });
      if (s.hp <= 0) {
        this._lose();
      }
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      s.result = { won: true, score: s.score, comboMax: s.comboMax, notesHit: s.notesHit, notesMissed: s.notesMissed };
      this._emit({ type: 'win', score: s.score, comboMax: s.comboMax, notesHit: s.notesHit });
    },

    _lose() {
      const s = this.state;
      s.phase = 'lost';
      s.result = { won: false, score: s.score, comboMax: s.comboMax, notesHit: s.notesHit, notesMissed: s.notesMissed };
      this._emit({ type: 'lose', score: s.score, comboMax: s.comboMax });
    },
  };

  return run;
}

// ------------------------------------------------------------------ 兼容骨架别名
export function createSim() {
  return createRun(0, { seed: 1 });
}

export function updateSim(sim, _input) {
  sim.step(1 / 60);
  return sim;
}
