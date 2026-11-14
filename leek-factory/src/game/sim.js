// 纯逻辑：三站产线（瓶颈决定吞吐）+ 手动收割 + 升级经济。
// 不碰 DOM / window / localStorage / Date.now；随机用可注入 seed。
import { STATIONS, UPGRADES, RULES } from '../../config/game.config.js';

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
    coins: 0,
    totalSold: 0,
    levels: { ...RULES.startLevels },
    events: [],
    rng: makeRng(seed),
  };
  if (saved) {
    run.coins = saved.coins || 0;
    run.totalSold = saved.totalSold || 0;
    run.levels = { ...RULES.startLevels, ...(saved.levels || {}) };
  }
  return run;
}

export function stationRate(run, id) {
  const st = STATIONS.find((s) => s.id === id);
  return run.levels[id] * st.base;
}

export function throughput(run) {
  return Math.min(...STATIONS.map((s) => stationRate(run, s.id)));
}

export function bottleneck(run) {
  let best = STATIONS[0].id;
  let min = Infinity;
  for (const s of STATIONS) {
    const r = stationRate(run, s.id);
    if (r < min) { min = r; best = s.id; }
  }
  return best;
}

export function valuePerLeek(run) {
  return run.levels.value * RULES.valueBase;
}

export function cps(run) {
  return throughput(run) * valuePerLeek(run);
}

export function clickValue(run) {
  return RULES.clickBase * valuePerLeek(run);
}

export function click(run) {
  const gained = clickValue(run);
  run.coins += gained;
  run.totalSold += RULES.clickBase;
  run.events.push({ type: 'harvest', gained, leeks: RULES.clickBase });
  return { gained };
}

export function tick(run, dt) {
  const sold = throughput(run) * dt;
  run.coins += sold * valuePerLeek(run);
  run.totalSold += sold;
  return { sold };
}

export function upgradeCost(run, id) {
  const up = UPGRADES.find((u) => u.id === id);
  return Math.floor(up.base * Math.pow(up.growth, run.levels[id]));
}

export function buy(run, id) {
  const cost = upgradeCost(run, id);
  if (run.coins < cost) return false;
  run.coins -= cost;
  run.levels[id] += 1;
  run.events.push({ type: 'upgrade', id, level: run.levels[id] });
  return true;
}

export function getHud(run) {
  return {
    coins: Math.floor(run.coins),
    totalSold: Math.floor(run.totalSold),
    throughput: throughput(run),
    valuePerLeek: valuePerLeek(run),
    cps: cps(run),
    bottleneck: bottleneck(run),
    levels: { ...run.levels },
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}

export function serialize(run) {
  return { coins: run.coins, totalSold: run.totalSold, levels: { ...run.levels } };
}