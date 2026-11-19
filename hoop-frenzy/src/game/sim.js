// HOOP FRENZY · 纯逻辑 sim（无 DOM / 无渲染）。
// 玩法：看力量条扫动，在指针进入绿色区间时出手，把能量球抛进左右交替的霓虹环。
// 空心 = 连击 + 加分；擦板 = 得分但连击清零；失手 = 无分且倒计时继续烧。
// 单球倒计时耗尽扣 1 命；3 命耗尽出局；拿到 WIN_SCORE 分通关。
import { GAME } from '../../config/game.config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 三角波：u ∈ [0,1) → 0..1..0
function triangle(u) {
  const x = u - Math.floor(u);
  return 1 - Math.abs(2 * x - 1);
}

function stageCfg(stage) {
  const s = clamp(stage, 1, GAME.STAGES.length) - 1;
  return GAME.STAGES[s];
}

/** 当前目标环的理想出手力量（力量条绿色区中心） */
export function idealPower(state) {
  return clamp(0.5 + (state.targetRingY - GAME.RING_BASE_Y) * GAME.AIM_K, 0.12, 0.88);
}

function bobAmp(state) {
  return stageCfg(state.stage).bobAmp;
}
function bobSpeed(state) {
  return stageCfg(state.stage).bobSpeed;
}

export function createRun(seed = 1) {
  const rng = mulberry32(seed);

  const state = {
    phase: 'aiming',        // aiming | recover | won | lost
    score: 0,
    goals: 0,               // 进球数（不是分数）
    combo: 0,
    lives: GAME.LIVES,
    clock: GAME.OFF_TIME_0,
    offTime: GAME.OFF_TIME_0,
    stage: 1,
    meterPhase: 0,
    power: 0,               // 当前力量条指针
    targetSide: -1,         // -1 = 左环，+1 = 右环
    targetRingY: GAME.RING_BASE_Y,
    golden: false,
    bobPhase: 0,
    ringBaseYL: GAME.RING_BASE_Y,
    ringBaseYR: GAME.RING_BASE_Y,
    recover: 0,
    time: 0,
    lastShot: null,         // {power, ideal, err, outcome}
  };

  let events = [];

  const targetRingX = () => (state.targetSide === -1 ? 250 : 1030);

  function setTargetRingY() {
    // 环 y = 随机基准 + 漂移偏移（阶段 3 起）
    const base = state.targetSide === -1 ? state.ringBaseYL : state.ringBaseYR;
    state.targetRingY = base + bobAmp(state) * Math.sin(state.bobPhase);
  }

  function advanceAfterGoal() {
    if (state.score >= GAME.WIN_SCORE) {
      state.phase = 'won';
      events.push('win');
      return;
    }
    const newStage = Math.floor(state.goals / GAME.STAGE_UP_GOALS) + 1;
    if (newStage > state.stage) {
      state.stage = newStage;
      events.push('stageUp');
    }
    // 换边
    state.targetSide = -state.targetSide;
    // 下一球是否金环（每 GOLDEN_EVERY 球一次）
    state.golden = ((state.goals + 1) % GAME.GOLDEN_EVERY === 0);
    if (state.golden) events.push('golden');
    // 新目标环随机基准 y
    const r = rng();
    const base = GAME.RING_BASE_MIN + r * (GAME.RING_BASE_MAX - GAME.RING_BASE_MIN);
    if (state.targetSide === -1) state.ringBaseYL = base;
    else state.ringBaseYR = base;
    setTargetRingY();
    // 倒计时随进球递减
    state.offTime = Math.max(GAME.OFF_TIME_MIN, GAME.OFF_TIME_0 - state.goals * GAME.OFF_TIME_DECAY);
    state.clock = state.offTime;
    state.phase = 'aiming';
  }

  function shoot() {
    if (state.phase !== 'aiming') return { ok: false };
    const power = state.power;
    const ideal = idealPower(state);
    const err = Math.abs(power - ideal);
    const cfg = stageCfg(state.stage);

    let outcome;
    if (err <= cfg.clean) outcome = 'swish';
    else if (err <= cfg.bank) outcome = 'bank';
    else outcome = 'miss';

    state.lastShot = { power, ideal, err, outcome };
    events.push('shoot');
    events.push('launch');

    if (outcome === 'swish') {
      let pts = 1 + (state.golden ? 1 : 0);
      state.combo += 1;
      if (state.combo >= 2) { pts += state.combo; events.push('combo'); }
      if (state.combo >= 3) { pts += 1; events.push('flame'); }
      state.score += pts;
      state.goals += 1;
      events.push('score', 'swish');
      advanceAfterGoal();
    } else if (outcome === 'bank') {
      state.score += 1 + (state.golden ? 1 : 0);
      state.combo = 0;
      state.goals += 1;
      events.push('score', 'bank');
      advanceAfterGoal();
    } else {
      state.combo = 0;
      events.push('miss');
      if (err <= cfg.bank + GAME.NEAR_MISS) events.push('nearMiss');
      state.phase = 'recover';
      state.recover = GAME.RECOVER_TIME;
    }
    return { ok: true, power, ideal, err, outcome };
  }

  function step(dt) {
    state.time += dt;
    state.meterPhase += dt;
    state.power = triangle(state.meterPhase / GAME.METER_PERIOD);
    state.bobPhase += dt * bobSpeed(state);
    setTargetRingY();

    if (state.phase === 'recover') {
      state.recover -= dt;
      if (state.recover <= 0) state.phase = 'aiming';
    }

    if (state.phase === 'aiming' || state.phase === 'recover') {
      state.clock -= dt;
      if (state.clock <= 0) {
        state.lives -= 1;
        events.push('lifeLost');
        if (state.lives <= 0) {
          state.phase = 'lost';
          events.push('lose');
        } else {
          state.clock = state.offTime;
          state.phase = 'aiming';
          state.recover = 0;
        }
      }
    }
  }

  function drainEvents() {
    const out = events;
    events = [];
    return out;
  }

  function getHud() {
    return {
      score: state.score,
      goals: state.goals,
      combo: state.combo,
      lives: state.lives,
      clock: state.clock,
      offTime: state.offTime,
      stage: state.stage,
      golden: state.golden,
      power: state.power,
      ideal: idealPower(state),
      targetSide: state.targetSide,
      targetRingY: state.targetRingY,
      targetRingX: targetRingX(),
    };
  }

  return {
    state,
    step,
    shoot,
    drainEvents,
    getHud,
    idealPower: () => idealPower(state),
  };
}
