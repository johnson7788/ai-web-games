// 纯逻辑 sim：放置合成（idle merge）。零 DOM，Node 可测。
// 规则（源自「合成小姐姐」P0，换皮 + 新机制）：
//   - 12 格，3 套收藏（页签），每套独立 12 格与最高等级。
//   - 每 2s 全体玩偶产金（连击加成）；购买当前最高等级（两两合成线性升阶）。
//   - 拖拽：同等级→合成升一级；不同→交换；空格→移动；岩块格不可落子。
//   - 岩块每 ~18s 在空格生成（上限 3），点击击碎得金币。
//   - 阶段：达到最高等级目标通关阶段，发奖励 + 解锁下一套收藏。
import { GAME } from '../../config/game.config.js';
import { dollByLevel, stageGoal, stageReward, MAX_LEVEL, STAGE_GOALS } from '../../config/levels.js';

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

function emptySlot() {
  return { doll: 0, rock: false };
}

function newTab() {
  return { maxLevel: 1, slots: Array.from({ length: GAME.SLOTS }, () => emptySlot()) };
}

export function createSim(opts = {}) {
  const rng = mulberry32(opts.seed == null ? 1 : opts.seed);

  const state = {
    tab: 0,
    tabs: [newTab(), newTab(), newTab()],
    unlockTabs: [true, false, false],
    gold: GAME.START_GOLD,
    totalGoldEarned: GAME.START_GOLD,
    stage: 1,            // 1-based 当前阶段
    combo: 0,
    lastMergeAt: -Infinity,
    comboBoostUntil: -Infinity,
    prodAccum: 0,
    rockTimer: 0,
    time: 0,
    events: [],
    seen: new Set(),
  };

  const cur = () => state.tabs[state.tab];

  function overallMaxLevel() {
    let m = 0;
    for (const t of state.tabs) m = Math.max(m, t.maxLevel);
    return m;
  }

  function comboMult() {
    if (state.time >= state.comboBoostUntil || state.combo < 2) return 1;
    return 1 + (state.combo - 1) * GAME.COMBO_PROD_BONUS;
  }

  function productionPerTick() {
    let sum = 0;
    for (const t of state.tabs) {
      for (const s of t.slots) if (s.doll > 0) sum += dollByLevel(s.doll).prod;
    }
    return Math.round(sum * comboMult());
  }

  function push(type, payload = {}) {
    state.events.push({ type, time: state.time, ...payload });
    state.seen.add(type);
  }

  function clearStageIfNeeded() {
    let guard = 0;
    while (guard < STAGE_GOALS.length && overallMaxLevel() >= stageGoal(state.stage - 1)) {
      const reward = stageReward(state.stage - 1);
      state.gold += reward;
      state.totalGoldEarned += reward;
      state.stage += 1;
      push('stage', { stage: state.stage, reward });
      if (state.stage === 3) { state.unlockTabs[1] = true; push('unlock', { tab: 1 }); }
      if (state.stage === 4) { state.unlockTabs[2] = true; push('unlock', { tab: 2 }); }
      guard += 1;
    }
  }

  function spawnRocks() {
    const tab = cur();
    let rocks = tab.slots.filter((s) => s.rock).length;
    for (let i = 0; i < tab.slots.length && rocks < GAME.ROCK_MAX; i += 1) {
      const empties = [];
      tab.slots.forEach((s, idx) => { if (!s.doll && !s.rock) empties.push(idx); });
      if (!empties.length) break;
      const idx = empties[Math.floor(rng() * empties.length)];
      tab.slots[idx].rock = true;
      rocks += 1;
      push('rockSpawn', { slot: idx, tab: state.tab });
    }
  }

  const run = {
    state,

    step(dt) {
      const d = Math.max(0, dt);
      state.time += d;

      // 生产（固定周期批量结算）
      state.prodAccum += d;
      while (state.prodAccum >= GAME.PROD_TICK) {
        state.prodAccum -= GAME.PROD_TICK;
        const amt = productionPerTick();
        if (amt > 0) {
          state.gold += amt;
          state.totalGoldEarned += amt;
          push('produce', { amount: amt });
        }
      }

      // 岩块生成
      state.rockTimer += d;
      if (state.rockTimer >= GAME.ROCK_INTERVAL) {
        state.rockTimer -= GAME.ROCK_INTERVAL;
        spawnRocks();
      }
    },

    drainEvents() {
      const out = state.events;
      state.events = [];
      return out;
    },

    buy() {
      const tab = cur();
      const maxLevel = Math.max(1, tab.maxLevel);
      // 买当前可负担的最高等级（≤ 最高已解锁等级）；钱不够买 1 级才算失败。
      // 保证软锁定：破产时也能买最低级重启生产。
      let level = 0;
      for (let L = maxLevel; L >= 1; L -= 1) {
        if (state.gold >= dollByLevel(L).cost) { level = L; break; }
      }
      if (level === 0) { push('error', { reason: 'gold' }); return { ok: false, reason: 'gold' }; }
      const slot = tab.slots.find((s) => !s.doll && !s.rock);
      if (slot == null) { push('error', { reason: 'space' }); return { ok: false, reason: 'space' }; }
      const d = dollByLevel(level);
      state.gold -= d.cost;
      slot.doll = level;
      push('buy', { level, slot: tab.slots.indexOf(slot) });
      return { ok: true, level, cost: d.cost };
    },

    drag(from, to) {
      if (from === to) return { ok: false };
      const tab = cur();
      const src = tab.slots[from];
      const dst = tab.slots[to];
      if (!src || !dst || src.doll === 0) return { ok: false };

      // 拖到回收区由上层处理（这里只处理格与格）
      if (dst.rock) { push('error', { reason: 'rock' }); return { ok: false, reason: 'rock' }; }

      if (dst.doll === 0) {
        dst.doll = src.doll;
        src.doll = 0;
        push('move', { from, to });
        return { ok: true, kind: 'move' };
      }

      if (dst.doll === src.doll) {
        if (src.doll >= MAX_LEVEL) { push('error', { reason: 'max' }); return { ok: false, reason: 'max' }; }
        const newLevel = src.doll + 1;
        src.doll = 0;
        dst.doll = newLevel;
        if (newLevel > tab.maxLevel) tab.maxLevel = newLevel;
        // 连击
        if (state.time - state.lastMergeAt <= GAME.COMBO_WINDOW) {
          state.combo = Math.min(GAME.COMBO_MAX, state.combo + 1);
        } else {
          state.combo = 1;
        }
        state.lastMergeAt = state.time;
        state.comboBoostUntil = state.time + GAME.COMBO_DURATION;
        const bonus = dollByLevel(newLevel).mergeBonus;
        state.gold += bonus;
        state.totalGoldEarned += bonus;
        push('merge', { level: newLevel, bonus, slot: to });
        if (state.combo > 1) push('combo', { combo: state.combo });
        clearStageIfNeeded();
        return { ok: true, kind: 'merge', level: newLevel, bonus };
      }

      // 交换
      const t = src.doll;
      src.doll = dst.doll;
      dst.doll = t;
      push('swap', { from, to });
      return { ok: true, kind: 'swap' };
    },

    sell(from) {
      const tab = cur();
      const src = tab.slots[from];
      if (!src || src.doll === 0) return { ok: false };
      const value = dollByLevel(src.doll).sell;
      src.doll = 0;
      state.gold += value;
      state.totalGoldEarned += value;
      push('sell', { value, slot: from });
      return { ok: true, value };
    },

    tapRock(slot) {
      const tab = cur();
      const s = tab.slots[slot];
      if (!s || !s.rock) return { ok: false };
      s.rock = false;
      state.gold += GAME.ROCK_REWARD;
      state.totalGoldEarned += GAME.ROCK_REWARD;
      push('rock', { reward: GAME.ROCK_REWARD, slot });
      return { ok: true, reward: GAME.ROCK_REWARD };
    },

    switchTab(tab) {
      if (tab === state.tab) return { ok: false };
      if (!state.unlockTabs[tab]) { push('error', { reason: 'locked' }); return { ok: false, reason: 'locked' }; }
      state.tab = tab;
      push('switch', { tab });
      return { ok: true, tab };
    },

    // 调试/测试辅助（纯逻辑，不影响玩法）
    maxLevel() { return overallMaxLevel(); },
    prodPerSec() { return productionPerTick() / GAME.PROD_TICK; },
  };

  return run;
}
