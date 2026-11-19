// RPS DUEL QI · 模拟层（纯逻辑，零 DOM / window / canvas / Date.now）
// 状态机：idle → playing ⇄ settle → won | lost
//   playing：宗师亮手 + 倒计时，玩家可 choose/useQi
//   settle ：回合结算后的短间隔（SETTLE_TIME），随后进入下一回合
// 数值规则（P0 1:1 + 3 个新机制）：
//   - 石克剪、剪克布、布克石（标准 RPS，宗师出手 paper 40% / rock 20% / scissors 40%）
//   - 胜：score+1、怒气-1（≥1）、气+1；败/超时：怒气+1、连击清零
//   - 怒气 1..5，到 5 游戏结束；打满 TOTAL_ROUNDS 通关
//   - 倒计时：score≤10 → 3.0s；score>10 → 随怒气 2.5/2.5/2.0/1.5s
// 新机制：连击（combo/maxCombo，星级钩子）、气（QI_MAX 攒满可爆发）、星级（1-3）
import { GAME } from '../../config/game.config.js';

export const HANDS = ['rock', 'scissors', 'paper'];
export const BEATS = { rock: 'scissors', scissors: 'paper', paper: 'rock' };
export const COUNTER_OF = { rock: 'paper', paper: 'scissors', scissors: 'rock' };

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
    phase: 'idle',            // idle | playing | settle | won | lost
    round: 0,                 // 当前回合（1 基）
    roundsDone: 0,
    wave: 1,
    bossHand: null,           // 当前宗师出手 'rock' | 'scissors' | 'paper'
    score: 0,
    combo: 0,
    maxCombo: 0,
    qi: 0,
    anger: GAME.ANGER_START,
    timeLeft: 0,
    roundTime: 0,
    totalRounds: GAME.TOTAL_ROUNDS,
    best: 0,                  // main 层写入（Sdk.load）
    last: null,               // { playerHand, bossHand, outcome, won }
    result: null,             // { won, score, stars, maxCombo, rounds, best }
  };

  const run = {
    state,
    _rng: rng,
    _events: [],
    _settleT: 0,
    _lastWhole: -1,

    start() {
      if (this.state.phase !== 'idle') return { ok: false, reason: 'phase' };
      this._emit({ type: 'start' });
      this._startRound();
      return { ok: true };
    },

    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost' || s.phase === 'idle') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      if (s.phase === 'settle') {
        this._settleT -= dt;
        if (this._settleT <= 0) this._startRound();
      } else if (s.phase === 'playing') {
        s.timeLeft -= dt;
        const whole = Math.floor(s.timeLeft);
        if (whole !== this._lastWhole && whole >= 0 && s.timeLeft > 0) {
          this._lastWhole = whole;
          this._emit({ type: 'countdownTick', timeLeft: whole });
        }
        if (s.timeLeft <= 0) {
          s.timeLeft = 0;
          this._resolveLose(null, 'timeout');
        }
      }
    },

    choose(hand) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (!HANDS.includes(hand)) return { ok: false, reason: 'hand' };
      this._emit({ type: 'choose', hand });
      if (BEATS[hand] === s.bossHand) this._resolveWin(hand, false);
      else this._resolveLose(hand, 'lose');
      return { ok: true };
    },

    useQi() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.qi < GAME.QI_MAX) return { ok: false, reason: 'noQi' };
      s.qi = 0;
      this._emit({ type: 'qiUsed', bossHand: s.bossHand });
      this._resolveWin('qi', true);
      return { ok: true };
    },

    getHud() {
      const s = this.state;
      return {
        phase: s.phase, round: s.round, wave: s.wave,
        score: s.score, combo: s.combo, maxCombo: s.maxCombo,
        qi: s.qi, qiMax: GAME.QI_MAX, anger: s.anger, angerMax: GAME.ANGER_MAX,
        timeLeft: s.timeLeft, roundTime: s.roundTime, bossHand: s.bossHand,
        totalRounds: s.totalRounds,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    _emit(e) { this._events.push(e); },

    _rollBoss() {
      const weights = GAME.BOSS_WEIGHTS;
      const total = weights.reduce((sum, [, w]) => sum + w, 0);
      let r = this._rng() * total;
      for (const [hand, w] of weights) {
        r -= w;
        if (r <= 0) return hand;
      }
      return 'paper';
    },

    _roundTime() {
      if (this.state.score <= 10) return GAME.ROUND_TIME_BASE;
      return GAME.ROUND_TIME_BY_ANGER[this.state.anger] ?? 1.5;
    },

    _startRound() {
      const s = this.state;
      s.round = s.roundsDone + 1;
      s.bossHand = this._rollBoss();
      s.roundTime = this._roundTime();
      s.timeLeft = s.roundTime;
      s.phase = 'playing';
      this._settleT = 0;
      this._lastWhole = Math.floor(s.timeLeft);
      this._emit({ type: 'roundStart', round: s.round });
      this._emit({ type: 'bossReveal', hand: s.bossHand });
    },

    _resolveWin(playerHand, viaQi) {
      const s = this.state;
      s.combo += 1;
      s.maxCombo = Math.max(s.maxCombo, s.combo);
      s.score += 1;
      s.anger = Math.max(1, s.anger - 1);
      if (!viaQi) {
        s.qi += 1;
        if (s.qi >= GAME.QI_MAX) {
          s.qi = GAME.QI_MAX;
          this._emit({ type: 'qiReady', qi: s.qi });
        }
      }
      s.last = { playerHand, bossHand: s.bossHand, outcome: viaQi ? 'qi' : 'win', won: true };
      this._emit({ type: 'win', playerHand, bossHand: s.bossHand, score: s.score, combo: s.combo, viaQi: !!viaQi });
      if (s.combo >= 2) this._emit({ type: 'combo', combo: s.combo });
      this._afterResolve();
    },

    _resolveLose(playerHand, outcome) {
      const s = this.state;
      s.combo = 0;
      s.anger += 1;
      s.last = { playerHand, bossHand: s.bossHand, outcome, won: false };
      this._emit({ type: outcome === 'timeout' ? 'timeout' : 'lose', playerHand, bossHand: s.bossHand });
      this._afterResolve();
    },

    _afterResolve() {
      const s = this.state;
      s.roundsDone += 1;
      const wave = Math.floor(s.roundsDone / 5) + 1;
      if (wave !== s.wave) {
        s.wave = wave;
        this._emit({ type: 'wave', wave });
      }
      if (s.anger >= GAME.ANGER_MAX) return this._finish(false);
      if (s.roundsDone >= s.totalRounds) return this._finish(true);
      s.phase = 'settle';
      this._settleT = GAME.SETTLE_TIME;
    },

    _finish(won) {
      const s = this.state;
      s.phase = won ? 'won' : 'lost';
      s.result = {
        won,
        score: s.score,
        stars: this._stars(won),
        maxCombo: s.maxCombo,
        rounds: s.roundsDone,
        best: s.best,
      };
      this._emit({ type: won ? 'clear' : 'gameover', score: s.score, stars: s.result.stars, maxCombo: s.maxCombo, rounds: s.roundsDone });
    },

    _stars(won) {
      const s = this.state;
      let stars = s.score >= 1 ? 1 : 0;
      if (s.maxCombo >= GAME.COMBO_STAR) stars = Math.max(stars, 2);
      if (won) stars = 3;
      return stars;
    },
  };

  return run;
}
