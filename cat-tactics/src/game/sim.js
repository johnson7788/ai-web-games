// CAT TACTICS · 纯逻辑 sim（无 DOM，Node 可测）
// P0 骨架 1:1（参考「猫咪攻略」）：招募 → 合并升级 → 拖上赛道巡逻赚金币 → 回收。
// 新机制：合并连击（combo）、战术加速（boost）、三星评级（mission stars）。
// 事件流：buy / merge / combo / levelup / deploy / stop / recycle / coin / lap / boost / boostEnd / mission / win / lose。
import { GAME, coinPerSec, lapSeconds, recycleValue } from '../../config/game.config.js';

export const SLOT_COUNT = GAME.SLOT_COUNT;
export const MAX_RUNNING = GAME.MAX_RUNNING;
export const LEVEL_MAX = GAME.LEVEL_MAX;
export const MISSIONS = GAME.MISSIONS;

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

function starsFor(t, limit) {
  if (t <= limit * 0.5) return 3;
  if (t <= limit * 0.8) return 2;
  return 1;
}

function makeCat(level) {
  return { level, running: false, progress: 0 };
}

export function createRun(opts = {}) {
  const state = {
    phase: 'playing', // playing | won | lost
    missionIndex: 0,
    mission: 1,       // 1 基
    target: MISSIONS[0].target,
    timeLimit: MISSIONS[0].timeLimit,
    missionTime: 0,
    time: 0,
    coins: GAME.START_COINS,
    gems: GAME.START_GEMS,
    recruitCost: GAME.RECRUIT_BASE,
    recruits: 0,
    totalEarned: 0,
    totalMerges: 0,
    maxLevel: 0,
    combo: 0,
    comboTimer: 0,
    boostLeft: 0,
    stars: 0,
    missionStars: [0, 0, 0],
    slots: new Array(SLOT_COUNT).fill(null), // null | {level,running,progress}
    incomePerSec: 0,
    runningCount: 0,
    seed: opts.seed | 0 || 1,
  };

  const events = [];
  let nextCoinTick = 1;

  function emit(ev) {
    events.push(ev);
  }

  function recomputeIncome() {
    let sum = 0;
    for (const c of state.slots) {
      if (c && c.running) sum += coinPerSec(c.level);
    }
    state.incomePerSec = sum;
  }

  function effectiveIncome() {
    return state.incomePerSec * (state.boostLeft > 0 ? GAME.BOOST_MULT : 1);
  }

  function countRunning() {
    let n = 0;
    for (const c of state.slots) if (c && c.running) n += 1;
    state.runningCount = n;
  }

  function firstEmptySlot() {
    for (let i = 0; i < SLOT_COUNT; i += 1) if (!state.slots[i]) return i;
    return -1;
  }

  function clearMission() {
    state.missionStars[state.missionIndex] = starsFor(state.missionTime, state.timeLimit);
    state.stars = state.missionStars.reduce((a, b) => a + b, 0);
    const gems = MISSIONS[state.missionIndex].gems;
    state.gems += gems;
    emit({
      type: 'mission',
      mission: state.mission,
      stars: state.missionStars[state.missionIndex],
      gems,
      earned: state.totalEarned,
    });
    if (state.missionIndex + 1 < MISSIONS.length) {
      state.missionIndex += 1;
      state.mission = state.missionIndex + 1;
      state.target = MISSIONS[state.missionIndex].target;
      state.timeLimit = MISSIONS[state.missionIndex].timeLimit;
      state.missionTime = 0;
    } else {
      state.phase = 'won';
      emit({ type: 'win', stars: state.stars, earned: state.totalEarned, mission: state.mission });
    }
  }

  function checkMission() {
    while (state.phase === 'playing' && state.totalEarned >= state.target) {
      clearMission();
    }
  }

  function checkLose() {
    if (state.phase === 'playing' && state.missionTime >= state.timeLimit) {
      state.phase = 'lost';
      emit({ type: 'lose', reason: 'timeOut', earned: state.totalEarned, mission: state.mission });
    }
  }

  const run = {
    state,

    buy() {
      if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
      const idx = firstEmptySlot();
      if (idx < 0) return { ok: false, reason: 'full' };
      if (state.coins < state.recruitCost) return { ok: false, reason: 'coins' };
      state.coins -= state.recruitCost;
      state.recruits += 1;
      const cost = state.recruitCost;
      state.recruitCost = Math.floor(state.recruitCost * GAME.RECRUIT_GROWTH);
      state.slots[idx] = makeCat(0);
      emit({ type: 'buy', level: 0, cost, slot: idx });
      return { ok: true, slot: idx };
    },

    merge(a, b) {
      if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
      const ca = state.slots[a];
      const cb = state.slots[b];
      if (!ca || !cb || a === b) return { ok: false, reason: 'none' };
      if (ca.running || cb.running) return { ok: false, reason: 'running' };
      if (ca.level !== cb.level) return { ok: false, reason: 'level' };
      if (ca.level >= LEVEL_MAX) return { ok: false, reason: 'max' };

      const newLevel = ca.level + 1;
      state.slots[a] = null;
      state.slots[b] = makeCat(newLevel);
      state.totalMerges += 1;

      // 连击：3 秒内连续合并（上限 8；奖励只进金币，不计入任务目标）
      if (state.comboTimer > 0) state.combo = Math.min(8, state.combo + 1);
      else state.combo = 1;
      state.comboTimer = GAME.COMBO_WINDOW;

      let bonus = 0;
      if (state.combo >= 2) {
        bonus = GAME.COMBO_BONUS_PER * state.combo * (newLevel + 1);
        state.coins += bonus;
        emit({ type: 'combo', combo: state.combo, bonus });
      }

      emit({ type: 'merge', level: newLevel, combo: state.combo, bonus });

      if (newLevel > state.maxLevel) {
        state.maxLevel = newLevel;
        emit({ type: 'levelup', level: newLevel });
      }

      checkMission();
      return { ok: true, slot: b, level: newLevel };
    },

    deploy(idx) {
      if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
      const c = state.slots[idx];
      if (!c) return { ok: false, reason: 'none' };
      if (c.running) return { ok: false, reason: 'running' };
      if (state.runningCount >= MAX_RUNNING) return { ok: false, reason: 'cap' };
      c.running = true;
      c.progress = 0;
      countRunning();
      recomputeIncome();
      emit({ type: 'deploy', level: c.level, slot: idx });
      return { ok: true };
    },

    stop(idx) {
      if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
      const c = state.slots[idx];
      if (!c || !c.running) return { ok: false, reason: 'none' };
      c.running = false;
      countRunning();
      recomputeIncome();
      emit({ type: 'stop', level: c.level, slot: idx });
      return { ok: true };
    },

    recycle(idx) {
      if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
      const c = state.slots[idx];
      if (!c) return { ok: false, reason: 'none' };
      const value = recycleValue(c.level);
      const wasRunning = c.running;
      state.slots[idx] = null;
      state.coins += value;
      state.totalEarned += value;
      if (wasRunning) { countRunning(); recomputeIncome(); }
      emit({ type: 'recycle', level: c.level, value, slot: idx });
      checkMission();
      return { ok: true, value };
    },

    boost() {
      if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (state.boostLeft > 0) return { ok: false, reason: 'active' };
      if (state.coins < GAME.BOOST_COST) return { ok: false, reason: 'coins' };
      state.coins -= GAME.BOOST_COST;
      state.boostLeft = GAME.BOOST_DURATION;
      emit({ type: 'boost', cost: GAME.BOOST_COST, duration: GAME.BOOST_DURATION });
      return { ok: true };
    },

    // 拖放：车位→车位（空位移动 / 同阶合并 / 异阶交换）
    dropSlot(from, to) {
      if (from === to) return { ok: false, reason: 'same' };
      const c = state.slots[from];
      if (!c) return { ok: false, reason: 'none' };
      if (c.running) return { ok: false, reason: 'running' };
      const t = state.slots[to];
      if (!t) {
        state.slots[to] = c;
        state.slots[from] = null;
        emit({ type: 'move', level: c.level, from, to });
        return { ok: true };
      }
      if (t.level === c.level && !t.running && c.level < LEVEL_MAX) {
        return run.merge(from, to);
      }
      // 交换
      state.slots[to] = c;
      state.slots[from] = t;
      emit({ type: 'move', level: c.level, from, to, swap: true });
      return { ok: true };
    },

    step(dt) {
      if (state.phase !== 'playing') return;
      state.time += dt;
      state.missionTime += dt;

      // 巡逻收入（连续累计）
      const inc = effectiveIncome();
      if (inc > 0) {
        const gained = inc * dt;
        state.coins += gained;
        state.totalEarned += gained;
        while (state.time >= nextCoinTick) {
          emit({ type: 'coin', amount: Math.round(inc), perSec: inc });
          nextCoinTick += 1;
        }
      }

      // 每只巡逻猫推进圈数（视觉）
      for (const c of state.slots) {
        if (c && c.running) {
          c.progress += dt / lapSeconds(c.level);
          if (c.progress >= 1) {
            c.progress -= 1;
            emit({ type: 'lap', level: c.level });
          }
        }
      }

      // 连击窗口衰减
      if (state.comboTimer > 0) {
        state.comboTimer -= dt;
        if (state.comboTimer <= 0) {
          state.comboTimer = 0;
          state.combo = 0;
        }
      }

      // 加速衰减
      if (state.boostLeft > 0) {
        state.boostLeft -= dt;
        if (state.boostLeft <= 0) {
          state.boostLeft = 0;
          emit({ type: 'boostEnd' });
        }
      }

      checkMission();
      checkLose();
    },

    drainEvents() {
      if (!events.length) return [];
      const out = events.slice();
      events.length = 0;
      return out;
    },

    getHud() {
      return {
        phase: state.phase,
        mission: state.mission,
        target: state.target,
        timeLimit: state.timeLimit,
        missionTime: state.missionTime,
        coins: Math.floor(state.coins),
        gems: state.gems,
        recruitCost: state.recruitCost,
        income: effectiveIncome(),
        incomeBase: state.incomePerSec,
        runningCount: state.runningCount,
        maxLevel: state.maxLevel,
        combo: state.combo,
        boostLeft: state.boostLeft,
        stars: state.stars,
        totalEarned: Math.floor(state.totalEarned),
        totalMerges: state.totalMerges,
      };
    },
  };

  return run;
}
