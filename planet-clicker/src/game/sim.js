// 纯逻辑：点击产能 + 自动产出 + 升级 + 星球解锁（倍率）。
// 不碰 DOM / window / localStorage / Date.now；随机用可注入 seed。
import { PLANETS, UPGRADES, RULES } from '../../config/game.config.js';

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
    energy: RULES.startEnergy,
    totalEnergy: 0,
    levels: { click: 0, solar: 0, drone: 0, fusion: 0 },
    planetIndex: 0,
    events: [],
    rng: makeRng(seed),
  };
  if (saved) {
    run.energy = saved.energy || 0;
    run.totalEnergy = saved.totalEnergy || 0;
    run.levels = { click: 0, solar: 0, drone: 0, fusion: 0, ...(saved.levels || {}) };
    run.planetIndex = saved.planetIndex || 0;
  }
  return run;
}

export function currentPlanet(run) {
  return PLANETS[run.planetIndex];
}
export function planetMult(run) {
  return PLANETS[run.planetIndex].mult;
}
export function clickPower(run) {
  return (1 + run.levels.click) * planetMult(run);
}
export function eps(run) {
  let base = 0;
  for (const u of UPGRADES) base += run.levels[u.id] * u.eps;
  return base * planetMult(run);
}
export function upgradeCost(run, id) {
  const up = UPGRADES.find((u) => u.id === id);
  return Math.floor(up.base * Math.pow(up.growth, run.levels[id]));
}

function checkPlanet(run) {
  while (run.planetIndex + 1 < PLANETS.length && run.totalEnergy >= PLANETS[run.planetIndex + 1].threshold) {
    run.planetIndex += 1;
    run.events.push({ type: 'planet', planetIndex: run.planetIndex });
  }
}

export function click(run) {
  const gained = clickPower(run);
  run.energy += gained;
  run.totalEnergy += gained;
  run.events.push({ type: 'click', gained });
  checkPlanet(run);
  return { gained };
}

export function tick(run, dt) {
  const gain = eps(run) * dt;
  run.energy += gain;
  run.totalEnergy += gain;
  checkPlanet(run);
  return { gain };
}

export function buy(run, id) {
  const cost = upgradeCost(run, id);
  if (run.energy < cost) return false;
  run.energy -= cost;
  run.levels[id] += 1;
  run.events.push({ type: 'upgrade', id, level: run.levels[id] });
  return true;
}

export function nextPlanetProgress(run) {
  if (run.planetIndex + 1 >= PLANETS.length) return 1;
  const cur = PLANETS[run.planetIndex].threshold;
  const next = PLANETS[run.planetIndex + 1].threshold;
  return Math.max(0, Math.min(1, (run.totalEnergy - cur) / (next - cur)));
}

export function getHud(run) {
  return {
    energy: Math.floor(run.energy),
    totalEnergy: Math.floor(run.totalEnergy),
    clickPower: clickPower(run),
    eps: eps(run),
    planetIndex: run.planetIndex,
    planetMult: planetMult(run),
    progress: nextPlanetProgress(run),
    levels: { ...run.levels },
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}

export function serialize(run) {
  return { energy: run.energy, totalEnergy: run.totalEnergy, levels: { ...run.levels }, planetIndex: run.planetIndex };
}

export const PLANET_COUNT = PLANETS.length;