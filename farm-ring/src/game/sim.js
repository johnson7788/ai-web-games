// 纯逻辑：环形农场（作物生长 + 收割 + 升级 + 自动收割）。
// 不碰 DOM / window / localStorage / Date.now；固定步长 tick(dt)。
import { RING, RULES, UPGRADES } from '../../config/game.config.js';

function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRun({ seed = 1, saved = null } = {}) {
  const plots = Array.from({ length: RING.PLOTS }, (_, i) => ({
    unlocked: i < RULES.startPlots,
    growth: 0,
  }));
  const run = {
    coins: 0,
    plots,
    levels: { growth: 0, value: 0, auto: 0, plot: 0 },
    totalHarvested: 0,
    events: [],
    rng: makeRng(seed),
  };
  if (saved) {
    run.coins = saved.coins || 0;
    run.totalHarvested = saved.totalHarvested || 0;
    run.levels = { growth: 0, value: 0, auto: 0, plot: 0, ...(saved.levels || {}) };
    const unlocked = Math.min(RING.PLOTS, RULES.startPlots + run.levels.plot);
    run.plots.forEach((p, i) => { p.unlocked = i < unlocked; p.growth = 0; });
  }
  return run;
}

export function growRate(run) {
  return 1 / (RULES.baseGrowTime * Math.pow(RULES.growthFactor, run.levels.growth));
}
export function cropValue(run) {
  return RULES.baseValue * (1 + run.levels.value * RULES.valuePerLevel);
}
export function unlockedCount(run) {
  return run.plots.filter((p) => p.unlocked).length;
}
export function upgradeCost(run, id) {
  const up = UPGRADES.find((u) => u.id === id);
  return Math.floor(up.base * Math.pow(up.growth, run.levels[id]));
}
export function upgradeMaxed(run, id) {
  if (id === 'plot') return unlockedCount(run) >= RING.PLOTS;
  return false;
}

function doHarvest(run, idx, auto) {
  const p = run.plots[idx];
  const gained = cropValue(run);
  run.coins += gained;
  p.growth = 0;
  run.totalHarvested += 1;
  run.events.push({ type: 'harvest', idx, gained, auto });
  return gained;
}

export function harvest(run, idx) {
  const p = run.plots[idx];
  if (!p || !p.unlocked || p.growth < 1) return { ok: false };
  const gained = doHarvest(run, idx, false);
  return { ok: true, gained };
}

export function tick(run, dt) {
  const rate = growRate(run);
  const auto = run.levels.auto > 0;
  run.plots.forEach((p, i) => {
    if (!p.unlocked) return;
    if (p.growth < 1) {
      p.growth = Math.min(1, p.growth + rate * dt);
    }
    if (p.growth >= 1 && auto) doHarvest(run, i, true);
  });
}

export function buy(run, id) {
  if (upgradeMaxed(run, id)) return false;
  const cost = upgradeCost(run, id);
  if (run.coins < cost) return false;
  run.coins -= cost;
  run.levels[id] += 1;
  if (id === 'plot') {
    const next = run.plots.find((p) => !p.unlocked);
    if (next) next.unlocked = true;
  }
  run.events.push({ type: 'upgrade', id, level: run.levels[id] });
  return true;
}

export function getHud(run) {
  return {
    coins: Math.floor(run.coins),
    totalHarvested: run.totalHarvested,
    unlocked: unlockedCount(run),
    totalPlots: RING.PLOTS,
    growRate: growRate(run),
    cropValue: cropValue(run),
    levels: { ...run.levels },
    ready: run.plots.filter((p) => p.unlocked && p.growth >= 1).length,
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}

export function serialize(run) {
  return { coins: run.coins, totalHarvested: run.totalHarvested, levels: { ...run.levels } };
}

export const PLOT_COUNT = RING.PLOTS;