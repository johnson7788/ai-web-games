// 纯逻辑：挖掘（点击/挂机）+ 矿层价值 + 升级经济。
// 不碰 DOM / window / localStorage / Date.now；随机用可注入 seed。
import { LAYERS, UPGRADES, RULES } from '../../config/game.config.js';

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
  const run = {
    money: RULES.startMoney,
    depth: 0,
    totalEarned: 0,
    levels: { pick: 0, drill: 0, refinery: 0 },
    events: [],
    rng: makeRng(seed),
  };
  if (saved) {
    run.money = saved.money || 0;
    run.depth = saved.depth || 0;
    run.totalEarned = saved.totalEarned || 0;
    run.levels = { pick: 0, drill: 0, refinery: 0, ...(saved.levels || {}) };
  }
  return run;
}

export function layerAt(depth) {
  for (const layer of LAYERS) {
    if (depth < layer.max) return layer;
  }
  return LAYERS[LAYERS.length - 1];
}

export function clickPower(run) {
  return 1 + run.levels.pick;
}
export function digRate(run) {
  return run.levels.drill * RULES.drillPerLevel;
}
export function incomeMult(run) {
  return 1 + run.levels.refinery * RULES.refineryPerLevel;
}
export function upgradeCost(run, id) {
  const up = UPGRADES.find((u) => u.id === id);
  return Math.floor(up.base * Math.pow(up.growth, run.levels[id]));
}

function dig(run, meters) {
  if (meters <= 0) return { earned: 0, meters: 0 };
  const before = layerAt(run.depth);
  const earned = meters * before.value * incomeMult(run);
  run.depth += meters;
  run.money += earned;
  run.totalEarned += earned;
  const after = layerAt(run.depth);
  if (after.id !== before.id) run.events.push({ type: 'layer', layer: after.id });
  return { earned, meters };
}

export function click(run) {
  const r = dig(run, clickPower(run));
  run.events.push({ type: 'dig', meters: r.meters, earned: r.earned });
  return r;
}

export function tick(run, dt) {
  return dig(run, digRate(run) * dt);
}

export function buy(run, id) {
  const cost = upgradeCost(run, id);
  if (run.money < cost) return false;
  run.money -= cost;
  run.levels[id] += 1;
  run.events.push({ type: 'upgrade', id, level: run.levels[id] });
  return true;
}

export function getHud(run) {
  return {
    money: Math.floor(run.money),
    depth: Math.floor(run.depth),
    totalEarned: Math.floor(run.totalEarned),
    clickPower: clickPower(run),
    digRate: digRate(run),
    incomeMult: incomeMult(run),
    layer: layerAt(run.depth).id,
    levels: { ...run.levels },
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}

export function serialize(run) {
  return { money: run.money, depth: run.depth, totalEarned: run.totalEarned, levels: { ...run.levels } };
}

export const LAYER_COUNT = LAYERS.length;