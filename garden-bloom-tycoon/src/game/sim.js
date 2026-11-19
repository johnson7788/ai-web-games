// 纯逻辑：花园大亨核心循环（可 Node 测试，无 DOM / canvas / 音频）。
// 玩法骨架 1:1 复刻参考源码的花田经营：种花 → 随时间产金币 → 收获 → 升级/进化 → 鲜花解锁地块。
// 换皮为原创六阶奇幻花 + 三新机制：岩石、连击、水滴道具。
import { PLANTS, PLOTS, ROCK, WATER, COMBO, MAX_STAGE, START } from '../../config/game.config.js';

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

export const plantById = (id) => PLANTS.find((p) => p.id === id) || PLANTS[0];
export const plantByKey = (key) => PLANTS.find((p) => p.key === key) || PLANTS[0];

// 某地块当前生长信息（不产生副作用）
export function growthAt(state, index) {
  const plot = state.plots[index];
  if (!plot || !plot.unlocked || plot.species < 1) {
    return { onceTime: 1, onceGold: 0, count: 0, progress: 0, accumulated: 0 };
  }
  const cfg = plantById(plot.species);
  const onceTime = Math.max(0.3, cfg.baseTime - (plot.level - 1) * cfg.speedUp);
  const onceGold = cfg.goldOnce + (plot.level - 1) * cfg.goldUp;
  const elapsed = Math.max(0, state.time - plot.growthStart);
  let count = Math.floor(elapsed / onceTime);
  count = Math.min(count, MAX_STAGE);
  const rest = elapsed - count * onceTime;
  const accumulated = plot.stageGold + count * onceGold;
  const progress = onceTime > 0 ? rest / onceTime : 0;
  return { onceTime, onceGold, count, progress, accumulated };
}

export function createRun(opts = {}) {
  const seed = opts.seed == null ? 1 : opts.seed;
  const rng = mulberry32(seed);

  const plots = PLOTS.map((p) => ({
    index: p.index,
    needBloom: p.needBloom,
    cost: p.cost,
    unlocked: p.index === 0,
    species: p.index === 0 ? 1 : 0,
    level: p.index === 0 ? 1 : 0,
    growthStart: 0,
    stageGold: 0,
  }));

  const rocks = [];
  for (let i = 0; i < ROCK.count; i += 1) rocks.push({ id: i, ready: true, respawnAt: 0 });

  const state = {
    phase: 'playing',
    seed,
    time: 0,
    coins: START.coins,
    water: START.water,
    blooms: START.blooms,
    gardenLevel: 1,
    plots,
    rocks,
    combo: { count: 0, lastHarvestAt: -999, mult: 1 },
    stats: { harvested: 0, upgraded: 0, evolved: 0, unlocked: 0, rocks: 0, watered: 0, comboBest: 1 },
    waterRegen: 0,
    events: [],
  };

  const push = (type, extra = {}) => state.events.push({ type, time: state.time, ...extra });

  const run = {
    state,
    rng,

    step(dt) {
      state.time += dt;
      for (const r of state.rocks) if (!r.ready && state.time >= r.respawnAt) r.ready = true;
      if (WATER.regenSec > 0) {
        state.waterRegen += dt;
        while (state.waterRegen >= WATER.regenSec) {
          state.waterRegen -= WATER.regenSec;
          if (state.water < WATER.cap) state.water += 1;
        }
      }
      // 连击超时自然衰减（不单独发事件）
      if (state.time - state.combo.lastHarvestAt > COMBO.windowSec) state.combo.count = 0;
    },

    harvest(index) {
      const plot = state.plots[index];
      if (!plot || !plot.unlocked || plot.species < 1) return { ok: false };
      const info = growthAt(state, index);
      if (info.accumulated < 1) return { ok: false };

      const gap = state.time - state.combo.lastHarvestAt;
      state.combo.count = gap <= COMBO.windowSec ? state.combo.count + 1 : 1;
      state.combo.lastHarvestAt = state.time;
      state.combo.mult = Math.min(COMBO.maxMult, state.combo.count);
      state.stats.comboBest = Math.max(state.stats.comboBest, state.combo.mult);

      // 连击只放大「自然生长」部分；水滴道具结算进 stageGold 的部分不受连击放大，
      // 避免「浇水→秒收→浇水」的无限滚雪球（水滴是道具，不是连击发动机）。
      const gained = Math.floor(info.count * info.onceGold * state.combo.mult + plot.stageGold);
      state.coins += gained;
      plot.stageGold = 0;
      plot.growthStart = state.time;
      state.stats.harvested += 1;
      push('harvest', { index, gained, mult: state.combo.mult, combo: state.combo.count });
      if (state.combo.mult >= 2) push('combo', { index, mult: state.combo.mult });
      return { ok: true, gained, mult: state.combo.mult };
    },

    upgrade(index) {
      const plot = state.plots[index];
      if (!plot || !plot.unlocked || plot.species < 1) return { ok: false };
      const cfg = plantById(plot.species);
      if (plot.level >= cfg.maxLevel) return { ok: false };
      if (state.coins < cfg.upCost) return { ok: false };
      state.coins -= cfg.upCost;
      plot.level += 1;
      plot.growthStart = state.time;
      state.stats.upgraded += 1;
      push('upgrade', { index, level: plot.level });
      return { ok: true, level: plot.level };
    },

    evolve(index) {
      const plot = state.plots[index];
      if (!plot || !plot.unlocked || plot.species < 1) return { ok: false };
      const cfg = plantById(plot.species);
      if (plot.level < cfg.maxLevel) return { ok: false };
      if (cfg.nextId < 1) return { ok: false };
      if (state.coins < cfg.evolveCost) return { ok: false };
      state.coins -= cfg.evolveCost;
      plot.species = cfg.nextId;
      plot.level = 1;
      plot.growthStart = state.time;
      plot.stageGold = 0;
      const next = plantById(plot.species);
      state.blooms += next.addBloom;
      state.stats.evolved += 1;
      push('evolve', { index, species: plot.species });
      push('bloom', { index, blooms: state.blooms, gained: next.addBloom });
      if (plot.species > state.gardenLevel) {
        state.gardenLevel = plot.species;
        push('levelup', { level: state.gardenLevel });
      }
      return { ok: true, species: plot.species };
    },

    unlockPlot(index) {
      const plot = state.plots[index];
      if (!plot || plot.unlocked) return { ok: false };
      if (state.blooms < plot.needBloom) return { ok: false };
      if (state.coins < plot.cost) return { ok: false };
      state.coins -= plot.cost;
      plot.unlocked = true;
      plot.species = 1;
      plot.level = 1;
      plot.growthStart = state.time;
      plot.stageGold = 0;
      state.stats.unlocked += 1;
      push('unlockPlot', { index });
      push('plant', { index, species: 1 });
      return { ok: true, index };
    },

    breakRock(id) {
      const rock = state.rocks.find((r) => r.id === id);
      if (!rock || !rock.ready) return { ok: false };
      rock.ready = false;
      rock.respawnAt = state.time + ROCK.respawnSec;
      const gained = ROCK.rewardBase + (state.gardenLevel - 1) * ROCK.rewardPerLevel;
      state.coins += gained;
      state.stats.rocks += 1;
      let waterGain = 0;
      if (rng() < ROCK.waterChance) {
        waterGain = 1;
        state.water = Math.min(WATER.cap, state.water + 1);
      }
      push('rock', { id, gained, waterGain });
      return { ok: true, gained, waterGain };
    },

    water(index) {
      const plot = state.plots[index];
      if (!plot || !plot.unlocked || plot.species < 1) return { ok: false };
      if (state.water < WATER.boostCost) return { ok: false };
      const cfg = plantById(plot.species);
      const onceGold = cfg.goldOnce + (plot.level - 1) * cfg.goldUp;
      state.water -= WATER.boostCost;
      plot.stageGold += onceGold;
      state.stats.watered += 1;
      push('water', { index, gained: onceGold });
      return { ok: true, gained: onceGold };
    },

    canUpgrade(index) {
      const plot = state.plots[index];
      if (!plot || !plot.unlocked || plot.species < 1) return false;
      const cfg = plantById(plot.species);
      return plot.level < cfg.maxLevel && state.coins >= cfg.upCost;
    },

    canEvolve(index) {
      const plot = state.plots[index];
      if (!plot || !plot.unlocked || plot.species < 1) return false;
      const cfg = plantById(plot.species);
      return plot.level >= cfg.maxLevel && cfg.nextId >= 1 && state.coins >= cfg.evolveCost;
    },

    canUnlock(index) {
      const plot = state.plots[index];
      if (!plot || plot.unlocked) return false;
      return state.blooms >= plot.needBloom && state.coins >= plot.cost;
    },

    getHud() {
      return {
        coins: state.coins,
        blooms: state.blooms,
        water: state.water,
        gardenLevel: state.gardenLevel,
        time: state.time,
        unlocked: state.plots.filter((p) => p.unlocked).length,
        combo: state.combo.mult,
      };
    },

    drainEvents() {
      const e = state.events;
      state.events = [];
      return e;
    },
  };

  return run;
}

// 反序列化（用于 Sdk 存档恢复）：任何字段异常都返回 null（调用方降级新开局）
export function restoreState(saved) {
  if (!saved || typeof saved !== 'object') return null;
  if (!Array.isArray(saved.plots) || saved.plots.length !== PLOTS.length) return null;
  const run = createRun({ seed: 1 });
  const s = run.state;
  s.coins = Number.isFinite(saved.coins) ? Math.max(0, saved.coins) : START.coins;
  s.blooms = Number.isFinite(saved.blooms) ? Math.max(0, saved.blooms) : 0;
  s.water = Number.isFinite(saved.water) ? Math.min(WATER.cap, Math.max(0, saved.water)) : START.water;
  s.gardenLevel = 1;
  for (let i = 0; i < PLOTS.length; i += 1) {
    const src = saved.plots[i];
    const dst = s.plots[i];
    if (!src) continue;
    dst.unlocked = src.unlocked === true;
    dst.species = Number.isFinite(src.species) ? Math.max(0, Math.min(6, src.species | 0)) : (i === 0 ? 1 : 0);
    dst.level = Number.isFinite(src.level) ? Math.max(1, src.level | 0) : (dst.species > 0 ? 1 : 0);
    dst.stageGold = Number.isFinite(src.stageGold) ? Math.max(0, src.stageGold) : 0;
    if (dst.species > s.gardenLevel) s.gardenLevel = dst.species;
  }
  s.gardenLevel = Math.max(1, s.gardenLevel);
  // 离线不结算（时间归零，从载入时刻重新开始生长）
  for (const p of s.plots) p.growthStart = 0;
  return run;
}
