// POKER RUSH 7 · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：目标卡生成、四泳道卡牌流动、点卡判定、漏接/错误胜负、连击与星级结算、事件表。
// 依赖：config/levels.js（LEVELS/LEVEL_COUNT）、config/game.config.js（WORLD/LAYOUT/GAME）。
// 契约：createRun(levelIndex, {seed}) → run；run.step(dt) / run.tap(cardId) / run.drainEvents() / run.getHud()。
// 随机：注入 seed 的 mulberry32，可复现。

import { LEVELS } from '../../config/levels.js';
import { WORLD, LAYOUT, GAME } from '../../config/game.config.js';

// ------------------------------------------------------------------ 花色 / 点数 / 颜色
export const SUITS = [
  { key: 'spade', sym: '♠' },
  { key: 'heart', sym: '♥' },
  { key: 'club', sym: '♣' },
  { key: 'diamond', sym: '♦' },
];

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// 霓虹街机 7 色（底色）
export const COLORS = [
  { key: 'pink', hex: '#ff4f8f', name: 'Pink' },
  { key: 'purple', hex: '#b45cff', name: 'Purple' },
  { key: 'cyan', hex: '#21d4c4', name: 'Cyan' },
  { key: 'orange', hex: '#ff8a3d', name: 'Orange' },
  { key: 'yellow', hex: '#ffd23d', name: 'Yellow' },
  { key: 'green', hex: '#4fd24f', name: 'Green' },
  { key: 'blue', hex: '#4d7cff', name: 'Blue' },
];

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

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

const CARD_STEP = LAYOUT.CARD_W + LAYOUT.LANE_GAP;

// ------------------------------------------------------------------ createRun
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const dirSign = level.direction === 'left' ? -1 : 1;
  const spawnX = dirSign === 1 ? -LAYOUT.CARD_W - 12 : WORLD.WIDTH + 12;
  const spawnInterval = CARD_STEP / (level.speed * WORLD.WIDTH);
  const canMissCount = GAME.MISS_BASE + Math.round(level.canMissRate * 4);

  const target = {
    suitIdx: Math.floor(rng() * SUITS.length),
    rankIdx: Math.floor(rng() * RANKS.length),
    colorIdx: Math.floor(rng() * COLORS.length),
  };

  // 干扰底色 = 目标色之外的 3 个颜色（用于普通干扰卡）
  const disturbColorIdx = [];
  for (let i = 0; i < COLORS.length; i += 1) {
    if (i !== target.colorIdx) disturbColorIdx.push(i);
  }

  const state = {
    level: level.index,
    phase: 'countdown', // 'countdown' | 'reveal' | 'playing' | 'won' | 'lost'
    direction: level.direction,
    dirSign,
    countdownLeft: level.countdownSec,
    revealLeft: level.revealSec,
    timeLeft: level.timeLimit,
    initialTime: level.timeLimit,
    target,
    cards: [],
    score: 0,
    combo: 0,
    maxCombo: 0,
    correctCount: 0,
    errorCount: 0,
    missCount: 0,
    canErrorCount: level.canErrorCount,
    canMissCount,
    stars: 0,
    result: null,
  };

  let nextId = 1;
  let spawnTimer = 0;

  const run = {
    state,
    _level: level,
    _rng: rng,
    _events: [],
    _lastSecond: Math.ceil(level.timeLimit),

    // ---- 时间推进
    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;

      if (s.phase === 'countdown') {
        s.countdownLeft -= dt;
        const sec = Math.ceil(s.countdownLeft);
        if (sec >= 0 && sec !== this._lastSecond) {
          this._lastSecond = sec;
          this._emit({ type: 'countdownTick', timeLeft: sec });
        }
        if (s.countdownLeft <= 0) {
          s.phase = 'reveal';
          this._emit({ type: 'reveal', target: { ...s.target } });
        }
        return;
      }

      if (s.phase === 'reveal') {
        s.revealLeft -= dt;
        if (s.revealLeft <= 0) {
          s.phase = 'playing';
          this._lastSecond = Math.ceil(s.timeLeft);
          this._emit({ type: 'playStart' });
        }
        return;
      }

      // playing
      s.timeLeft -= dt;
      const sec = Math.ceil(s.timeLeft);
      if (sec !== this._lastSecond) {
        this._lastSecond = sec;
        this._emit({ type: 'countdownTick', timeLeft: Math.max(0, sec) });
      }

      const speed = this._level.speed * WORLD.WIDTH;
      for (let i = s.cards.length - 1; i >= 0; i -= 1) {
        const c = s.cards[i];
        c.x += s.dirSign * speed * dt;
        if (s.dirSign === 1 ? c.x > WORLD.WIDTH + LAYOUT.CARD_W + 20 : c.x < -LAYOUT.CARD_W - 20) {
          s.cards.splice(i, 1);
          if (c.ok && !c.use) this._miss(c);
        }
      }

      spawnTimer += dt;
      while (spawnTimer >= spawnInterval) {
        spawnTimer -= spawnInterval;
        this._spawnWave();
      }

      if (s.timeLeft <= 0) {
        s.timeLeft = 0;
        this._win();
      }
    },

    // ---- 点卡
    tap(cardId) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      const c = s.cards.find((x) => x.id === cardId);
      if (!c) return { ok: false, reason: 'notFound' };
      if (c.use) return { ok: false, reason: 'used' };

      if (c.ok && !c.rock) {
        c.use = true;
        s.correctCount += 1;
        s.combo += 1;
        s.maxCombo = Math.max(s.maxCombo, s.combo);
        const mult = 1 + Math.floor(s.combo / GAME.COMBO_STEP);
        s.score += GAME.BASE_SCORE * mult;
        this._emit({ type: 'tapCorrect', cardId, combo: s.combo, mult, score: s.score });
        if (s.combo > 0 && s.combo % GAME.COMBO_STEP === 0) {
          this._emit({ type: 'combo', combo: s.combo, mult });
        }
        return { ok: true, correct: true };
      }

      // 点错：岩石或干扰卡
      s.combo = 0;
      s.errorCount += 1;
      const rock = !!c.rock;
      this._emit({ type: rock ? 'tapRock' : 'tapWrong', cardId, errorCount: s.errorCount });
      if (s.errorCount > s.canErrorCount) this._lose('error');
      return { ok: true, correct: false, rock };
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        timeLeft: s.timeLeft,
        phase: s.phase,
        score: s.score,
        combo: s.combo,
        maxCombo: s.maxCombo,
        correct: s.correctCount,
        errorCount: s.errorCount,
        missCount: s.missCount,
        canErrorCount: s.canErrorCount,
        canMissCount: s.canMissCount,
        target: { ...s.target },
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _miss(c) {
      const s = this.state;
      s.missCount += 1;
      this._emit({ type: 'miss', cardId: c.id, missCount: s.missCount });
      if (s.missCount > s.canMissCount) this._lose('miss');
    },

    _rollCard() {
      const s = this.state;
      const r = this._rng();
      if (r < this._level.rockRate) {
        return { ok: false, rock: true, suitIdx: -1, rankIdx: -1, colorIdx: -1 };
      }
      if (this._rng() < this._level.targetRate) {
        return { ok: true, rock: false, suitIdx: s.target.suitIdx, rankIdx: s.target.rankIdx, colorIdx: s.target.colorIdx };
      }
      // 干扰卡
      const decoy = this._rng() < this._level.decoyRate;
      if (decoy) {
        // 同底色混淆：颜色 = 目标色，但花色/点数至少一项不同
        let suitIdx = Math.floor(this._rng() * SUITS.length);
        let rankIdx = Math.floor(this._rng() * RANKS.length);
        if (suitIdx === s.target.suitIdx && rankIdx === s.target.rankIdx) {
          suitIdx = (suitIdx + 1) % SUITS.length;
        }
        return { ok: false, rock: false, suitIdx, rankIdx, colorIdx: s.target.colorIdx };
      }
      const colorIdx = disturbColorIdx[Math.floor(this._rng() * disturbColorIdx.length)];
      return {
        ok: false,
        rock: false,
        suitIdx: Math.floor(this._rng() * SUITS.length),
        rankIdx: Math.floor(this._rng() * RANKS.length),
        colorIdx,
      };
    },

    _spawnWave() {
      const s = this.state;
      for (let lane = 0; lane < GAME.LANE_COUNT; lane += 1) {
        const card = this._rollCard();
        card.id = nextId++;
        card.lane = lane;
        card.x = s.dirSign === 1 ? -LAYOUT.CARD_W - 12 : WORLD.WIDTH + 12;
        card.use = false;
        s.cards.push(card);
      }
      this._emit({ type: 'cardSpawn', count: GAME.LANE_COUNT });
    },

    _win() {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      s.phase = 'won';
      const stars = 1
        + (s.maxCombo >= GAME.STAR_COMBO_2 ? 1 : 0)
        + (s.missCount === 0 && s.maxCombo >= GAME.STAR_COMBO_3 ? 1 : 0);
      s.stars = stars;
      s.result = { won: true, stars, score: s.score, maxCombo: s.maxCombo, correct: s.correctCount, missCount: s.missCount, errorCount: s.errorCount };
      this._emit({ type: 'win', stars, score: s.score, maxCombo: s.maxCombo });
    },

    _lose(reason) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      s.phase = 'lost';
      s.result = { won: false, stars: 0, score: s.score, maxCombo: s.maxCombo, correct: s.correctCount, missCount: s.missCount, errorCount: s.errorCount, reason };
      this._emit({ type: 'lose', reason });
    },
  };

  // 初始铺卡（每泳道 INITIAL_PER_LANE 张）
  for (let lane = 0; lane < GAME.LANE_COUNT; lane += 1) {
    for (let k = 0; k < GAME.INITIAL_PER_LANE; k += 1) {
      const card = run._rollCard();
      card.id = nextId++;
      card.lane = lane;
      card.x = spawnX + dirSign * k * CARD_STEP;
      card.use = false;
      state.cards.push(card);
    }
  }
  spawnTimer = spawnInterval * 0.5; // 首波补卡错开半拍

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
