// SUNFLOWER SASSY · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// P0（1:1 原味骨架）：左右方向牌反应匹配 + 每秒按键速率→分数/舞速里程碑表 + 40s 倒计时。
// 新机制：岩石牌 DODGE / 3 心生命 / 连击倍率 + FEVER / 星级结算 / 每张牌倒计时环。
// 随机：注入 seed 的 mulberry32，可复现。

import { GAME } from '../../config/game.config.js';

export const ROUND_TIME = GAME.ROUND_TIME;
export const QUEUE_LEN = GAME.QUEUE_LEN;
export const MAX_HEARTS = GAME.MAX_HEARTS;
export const FEVER_COMBO = GAME.FEVER_COMBO;

// P0 1:1 里程碑表：每秒正确按键速率 → 单秒得分 + 舞速（原表 spend/score/animLevel）
export const TIERS = [
  { rate: 1,  score: 1,   speed: 0.3 },
  { rate: 2,  score: 20,  speed: 0.5 },
  { rate: 5,  score: 30,  speed: 1.0 },
  { rate: 10, score: 40,  speed: 1.3 },
  { rate: 15, score: 60,  speed: 1.5 },
  { rate: 20, score: 100, speed: 2.0 },
];

const ROCK_P = [0, 0.22, 0.30];   // 各阶段岩石出现概率（stage 1/2/3）

export function stageFor(elapsed) {
  if (elapsed >= 28) return 3;
  if (elapsed >= 14) return 2;
  return 1;
}

function deadlineFor(stage, tier) {
  const base = [2.2, 1.7, 1.3][stage - 1] ?? 2.2;
  return Math.max(0.9, base - tier * 0.08);
}

function rollDir(rng, stage) {
  const p = ROCK_P[stage - 1] ?? 0;
  if (p > 0 && rng() < p) return 'rock';
  return rng() < 0.5 ? 'left' : 'right';
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRun(opts = {}) {
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const state = {
    phase: 'playing',        // 'playing' | 'won' | 'lost'
    timeLeft: ROUND_TIME,
    initialTime: ROUND_TIME,
    elapsed: 0,
    stage: 1,                // 1..3（时间驱动）
    score: 0,
    combo: 0,                // 连续正确次数（失误/超时归零）
    maxCombo: 0,
    rate: 0,                 // 本 1 秒窗口内的正确按键数
    speedTier: 0,            // TIERS index
    speed: 0.3,              // 当前舞速（渲染用）
    hearts: MAX_HEARTS,
    maxHearts: MAX_HEARTS,
    fever: false,
    feverT: 0,
    deadline: deadlineFor(1, 0), // 当前牌倒计时环
    deadlineMax: deadlineFor(1, 0),
    queue: [],               // [{dir:'left'|'right'|'rock'}]
    stars: 0,
    result: null,
    taps: 0,
    correct: 0,
    dodges: 0,
    mistakes: 0,
    timeouts: 0,
    rockSpawns: 0,
  };

  const run = {
    state,
    _rng: rng,
    _events: [],
    _stepT: 0,
    _lastSec: ROUND_TIME,

    multiplier() {
      let m = 1 + Math.floor(this.state.combo / 10);
      if (this.state.fever) m += 1;
      return Math.min(6, m);
    },

    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;

      s.elapsed += dt;
      s.timeLeft = Math.max(0, s.initialTime - s.elapsed);

      const ns = stageFor(s.elapsed);
      if (ns !== s.stage) {
        s.stage = ns;
        this._emit({ type: 'stage', stage: ns });
      }

      // 每秒计分（P0 1:1 的 1s 节拍）
      this._stepT += dt;
      while (this._stepT >= 1) {
        this._stepT -= 1;
        this._scoreTick();
      }

      // 每张牌倒计时环
      s.deadline -= dt;
      if (s.deadline <= 0) this._timeout();

      const sec = Math.ceil(s.timeLeft);
      if (sec < this._lastSec && sec >= 0) {
        this._lastSec = sec;
        this._emit({ type: 'countdownTick', timeLeft: sec });
      }

      if (s.fever) s.feverT += dt;

      if (s.timeLeft <= 0 && s.phase === 'playing') this._win();
    },

    _scoreTick() {
      const s = this.state;
      if (s.rate <= 0) {
        s.speed = 0.3;
        s.speedTier = 0;
        return;
      }
      let tier = null;
      for (let i = 0; i < TIERS.length; i += 1) {
        if (s.rate >= TIERS[i].rate) tier = { ...TIERS[i], index: i };
      }
      if (!tier) return;
      s.rate = 0;
      const gained = tier.score * this.multiplier();
      s.score += gained;
      s.speed = tier.speed;
      s.speedTier = tier.index;
      this._emit({ type: 'score', gained, tier: tier.index, score: s.score });
    },

    tap(dir) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (dir !== 'left' && dir !== 'right' && dir !== 'dodge') return { ok: false, reason: 'badDir' };
      const cur = s.queue[0];
      if (!cur) return { ok: false, reason: 'empty' };
      const expected = cur.dir === 'rock' ? 'dodge' : cur.dir;
      s.taps += 1;

      if (dir === expected) {
        s.correct += 1;
        s.rate += 1;
        s.combo += 1;
        if (s.combo > s.maxCombo) s.maxCombo = s.combo;
        if (cur.dir === 'rock') {
          s.dodges += 1;
          this._emit({ type: 'dodge', combo: s.combo });
        } else {
          this._emit({ type: 'match', dir, combo: s.combo });
        }
        this._advanceQueue();
        this._resetDeadline();
        if (s.combo % 10 === 0) this._emit({ type: 'combo', combo: s.combo });
        if (!s.fever && s.combo >= FEVER_COMBO) {
          s.fever = true;
          s.feverT = 0;
          this._emit({ type: 'fever', combo: s.combo });
        }
      } else {
        s.mistakes += 1;
        this._breakCombo();
        s.hearts -= 1;
        this._emit({ type: 'miss', expected, got: dir });
        if (s.hearts <= 0) this._lose('hearts');
      }
      return { ok: true };
    },

    _resetDeadline() {
      const s = this.state;
      s.deadline = deadlineFor(s.stage, s.speedTier);
      s.deadlineMax = s.deadline;
    },

    _breakCombo() {
      const s = this.state;
      s.combo = 0;
      s.rate = 0;
      s.fever = false;
      s.feverT = 0;
      s.speed = 0.3;
      s.speedTier = 0;
    },

    _timeout() {
      const s = this.state;
      if (s.phase !== 'playing') return;
      s.timeouts += 1;
      this._breakCombo();
      s.hearts -= 1;
      this._emit({ type: 'timeout' });
      this._advanceQueue();
      this._resetDeadline();
      if (s.hearts <= 0) this._lose('timeout');
    },

    _advanceQueue() {
      const s = this.state;
      s.queue.shift();
      const dir = rollDir(this._rng, s.stage);
      if (dir === 'rock') {
        s.rockSpawns += 1;
        this._emit({ type: 'rockSpawn' });
      }
      s.queue.push({ dir });
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      const stars = s.score >= GAME.STAR_3 ? 3 : s.score >= GAME.STAR_2 ? 2 : 1;
      s.stars = stars;
      s.result = { won: true, stars, score: s.score, combo: s.maxCombo, timeLeft: 0, reason: 'timeUp' };
      this._emit({ type: 'win', stars, score: s.score });
    },

    _lose(reason) {
      const s = this.state;
      s.phase = 'lost';
      s.stars = 0;
      s.result = { won: false, stars: 0, score: s.score, combo: s.maxCombo, timeLeft: s.timeLeft, reason };
      this._emit({ type: 'lose', reason, score: s.score });
    },

    getHud() {
      const s = this.state;
      return {
        phase: s.phase,
        timeLeft: s.timeLeft,
        stage: s.stage,
        score: s.score,
        combo: s.combo,
        hearts: s.hearts,
        maxHearts: s.maxHearts,
        fever: s.fever,
        speedTier: s.speedTier,
        speed: s.speed,
        deadline: s.deadline,
        stars: s.stars,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    _emit(e) { this._events.push(e); },
  };

  // 初始队列：stage 1 无岩石
  for (let i = 0; i < QUEUE_LEN; i += 1) {
    state.queue.push({ dir: rollDir(rng, 1) });
  }

  return run;
}

// ------------------------------------------------------------------ 兼容别名
export function createSim() {
  return createRun({ seed: 1 });
}

export function updateSim(sim, _input) {
  sim.step(1 / 60);
  return sim;
}
