// 静态数值表：等级奖励 / 怪物 / 物品 / 商店 / 装备。全部原创（重做主题，不复制原作素材文本）。
// sim 与 floorgen 共同依赖，零 DOM，Node 可直接 import。

import { GAME } from '../../config/game.config.js';

// ---- 等级奖励：升到第 L 级（L>=2）时获得的增量 + 下一级所需经验 ----
export function levelReward(L) {
  return {
    hp: 20 + Math.floor(L * 3),
    atk: 2 + Math.floor(L / 4),
    def: 1 + Math.floor(L / 5),
    nextExp: 8 + L * 14,
  };
}

export function nextExpFor(level) {
  if (level <= 1) return GAME.START.nextExp;
  return levelReward(level).nextExp;
}

// ---- 怪物：按层 + 档位程序化生成 ----
export const MONSTER_NAMES = [
  { en: 'Void Sprite', zh: '虚空精灵' },
  { en: 'Neon Wisp', zh: '霓虹幽魂' },
  { en: 'Pulse Drone', zh: '脉冲无人机' },
  { en: 'Core Guard', zh: '星核守卫' },
  { en: 'Photon Serpent', zh: '光子蛇' },
  { en: 'Cinder Golem', zh: '灰烬魔像' },
  { en: 'Frost Wraith', zh: '冰霜怨灵' },
  { en: 'Plasma Hound', zh: '等离子猎犬' },
  { en: 'Star Scavenger', zh: '星屑拾荒者' },
  { en: 'Gravity Lurker', zh: '引力潜伏者' },
  { en: 'Nova Knight', zh: '新星骑士' },
];
export const BOSS_NAME = { en: 'The Singularity', zh: '奇点核心' };

export function monsterStats(f, tier = 'normal') {
  const mul = tier === 'elite' ? 1.55 : tier === 'boss' ? 2.6 : 1;
  return {
    hp: Math.round((16 + f * 14 + f * f * 0.4) * mul),
    atk: Math.round((7 + f * 3.2) * mul),
    def: Math.round((3 + f * 2.0) * mul),
    exp: Math.round((2 + f * 1.2) * (tier === 'elite' ? 1.6 : tier === 'boss' ? 5 : 1)),
    gold: Math.round((4 + f * 2) * (tier === 'elite' ? 1.8 : tier === 'boss' ? 10 : 1)),
    miss: tier === 'boss' ? 0 : 0.01,
  };
}

// ---- 物品 ----
export const ITEMS = {
  potion_small: { kind: 'potion', ratio: GAME.POTION_SMALL_RATIO, name: { en: 'Small repair', zh: '小型修复剂' } },
  potion_large: { kind: 'potion', ratio: GAME.POTION_LARGE_RATIO, name: { en: 'Large repair', zh: '大型修复剂' } },
  gem_atk: { kind: 'gem', atk: GAME.GEM_ATK, name: { en: 'Red crystal', zh: '红晶' } },
  gem_def: { kind: 'gem', def: GAME.GEM_DEF, name: { en: 'Blue crystal', zh: '蓝晶' } },
  key_yellow: { kind: 'key', color: 'yellow', name: { en: 'Yellow keycard', zh: '黄钥卡' } },
  key_blue: { kind: 'key', color: 'blue', name: { en: 'Blue keycard', zh: '蓝钥卡' } },
  key_red: { kind: 'key', color: 'red', name: { en: 'Red keycard', zh: '红钥卡' } },
  sword_1: { kind: 'sword', tier: 1, base: GAME.SWORD_BASE[0], name: { en: 'Beam Sword I', zh: '光束剑 I' } },
  sword_2: { kind: 'sword', tier: 2, base: GAME.SWORD_BASE[1], name: { en: 'Beam Sword II', zh: '光束剑 II' } },
  sword_3: { kind: 'sword', tier: 3, base: GAME.SWORD_BASE[2], name: { en: 'Beam Sword III', zh: '光束剑 III' } },
  sword_4: { kind: 'sword', tier: 4, base: GAME.SWORD_BASE[3], name: { en: 'Beam Sword IV', zh: '光束剑 IV' } },
  sword_5: { kind: 'sword', tier: 5, base: GAME.SWORD_BASE[4], name: { en: 'Beam Sword V', zh: '光束剑 V' } },
  sword_6: { kind: 'sword', tier: 6, base: GAME.SWORD_BASE[5], name: { en: 'Beam Sword VI', zh: '光束剑 VI' } },
  shield_1: { kind: 'shield', tier: 1, base: GAME.SHIELD_BASE[0], name: { en: 'Energy Shield I', zh: '能量盾 I' } },
  shield_2: { kind: 'shield', tier: 2, base: GAME.SHIELD_BASE[1], name: { en: 'Energy Shield II', zh: '能量盾 II' } },
  shield_3: { kind: 'shield', tier: 3, base: GAME.SHIELD_BASE[2], name: { en: 'Energy Shield III', zh: '能量盾 III' } },
  shield_4: { kind: 'shield', tier: 4, base: GAME.SHIELD_BASE[3], name: { en: 'Energy Shield IV', zh: '能量盾 IV' } },
  shield_5: { kind: 'shield', tier: 5, base: GAME.SHIELD_BASE[4], name: { en: 'Energy Shield V', zh: '能量盾 V' } },
  shield_6: { kind: 'shield', tier: 6, base: GAME.SHIELD_BASE[5], name: { en: 'Energy Shield VI', zh: '能量盾 VI' } },
  stone_sword: { kind: 'stone', slot: 'sword', name: { en: 'Sword stone', zh: '剑灵石' } },
  stone_shield: { kind: 'stone', slot: 'shield', name: { en: 'Shield stone', zh: '盾灵石' } },
  scroll_teleport: { kind: 'scroll', name: { en: 'Teleport scroll', zh: '传送卷轴' } },
  cross: { kind: 'cross', name: { en: 'Revival core', zh: '复活核心' } },
};

export function itemName(id, lang) {
  return ITEMS[id] ? ITEMS[id].name[lang] || ITEMS[id].name.en : id;
}

// ---- 商店（星锻工坊）----
export const SHOP = [
  { id: 'potion_small', basePrice: 50, step: 1, maxPrice: 250 },
  { id: 'potion_large', basePrice: 200, step: 1, maxPrice: 500 },
  { id: 'gem_atk', basePrice: 100, step: 1, maxPrice: 200 },
  { id: 'gem_def', basePrice: 100, step: 1, maxPrice: 200 },
  { id: 'key_yellow', basePrice: 40, step: 1, maxPrice: 160 },
  { id: 'key_blue', basePrice: 60, step: 1, maxPrice: 220 },
  { id: 'key_red', basePrice: 90, step: 1, maxPrice: 300 },
];

// 剑/盾强化价格（每强化一次递增）
export function enhancePrice(enhanceLevel) {
  return 30 + enhanceLevel * 40;
}

// 全局唯一 RNG（mulberry32），floorgen 与 selfplay 复用
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
