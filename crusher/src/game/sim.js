// 纯逻辑：点击粉碎 + 自动粉碎（放置）+ 升级经济 + 材料层级。
// 不碰 DOM / window / localStorage / Date.now；随机用可注入 seed。
import { TIERS, UPGRADES, RULES } from '../../config/game.config.js';

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
    totalCoins: 0,
    crushed: 0,
    levels: { click: 0, auto: 0, crit: 0 },
    hp: 0,
    maxHp: 0,
    events: [],
    rng: makeRng(seed),
  };
  if (saved) {
    run.coins = saved.coins || 0;
    run.totalCoins = saved.totalCoins || 0;
    run.crushed = saved.crushed || 0;
    run.levels = { click: 0, auto: 0, crit: 0, ...(saved.levels || {}) };
  }
  run.maxHp = objectMaxHp(run);
  run.hp = run.maxHp;
  return run;
}

export function tierIndex(run) {
  return Math.min(Math.floor(run.crushed / RULES.objectsPerTier), TIERS.length - 1);
}
export function tierProgress(run) {
  return run.crushed % RULES.objectsPerTier;
}
export function currentTier(run) {
  return TIERS[tierIndex(run)];
}
export function objectMaxHp(run) {
  const t = currentTier(run);
  return Math.round(t.hp * (1 + RULES.hpPerProgress * tierProgress(run)));
}
export function objectValue(run) {
  const t = currentTier(run);
  return Math.round(t.value * (1 + RULES.valuePerProgress * tierProgress(run)));
}
export function clickPower(run) {
  return 1 + run.levels.click;
}
export function dps(run) {
  return run.levels.auto * RULES.autoPerLevel;
}
export function critChance(run) {
  return Math.min(RULES.critCap, run.levels.crit * RULES.critPerLevel);
}
export function upgradeCost(run, id) {
  const up = UPGRADES.find((u) => u.id === id);
  return Math.floor(up.base * Math.pow(up.growth, run.levels[id]));
}

// 施加伤害；HP≤0 则粉碎（结算金币/升阶/重生）。
function applyDamage(run, amount) {
  run.hp -= amount;
  let broke = false;
  let value = 0;
  let tierUp = false;
  if (run.hp <= 0) {
    broke = true;
    value = objectValue(run);
    const before = tierIndex(run);
    run.coins += value;
    run.totalCoins += value;
    run.crushed += 1;
    const after = tierIndex(run);
    tierUp = after > before;
    run.maxHp = objectMaxHp(run);
    run.hp = run.maxHp;
    run.events.push({ type: 'crush', value, tier: after, tierUp });
    if (tierUp) run.events.push({ type: 'tier_up', tier: after });
  }
  return { broke, value, tierUp };
}

export function click(run) {
  const crit = run.rng() < critChance(run);
  const damage = clickPower(run) * (crit ? RULES.critMult : 1);
  run.events.push({ type: 'click', damage, crit });
  const r = applyDamage(run, damage);
  return { damage, crit, ...r };
}

export function tick(run, dt) {
  const d = dps(run) * dt;
  if (d <= 0) return { broke: false, value: 0, tierUp: false };
  return applyDamage(run, d);
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
    crushed: run.crushed,
    tier: tierIndex(run),
    tierProgress: tierProgress(run),
    hp: Math.max(0, run.hp),
    maxHp: run.maxHp,
    clickPower: clickPower(run),
    dps: dps(run),
    critChance: critChance(run),
    value: objectValue(run),
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}

export function serialize(run) {
  return { coins: run.coins, totalCoins: run.totalCoins, crushed: run.crushed, levels: { ...run.levels } };
}

export const TIER_COUNT = TIERS.length;