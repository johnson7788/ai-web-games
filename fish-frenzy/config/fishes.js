// FISH FRENZY · 鱼种表（发光深海种，原创）
// hp = 捕获门槛（血量），value = 基础倍率（捕获奖励 = value × 炮档）
// value/hp = 期望收益/币（>1 才值得打）；小鱼是「诱饵」——打它反而亏。
// weight = 鱼汛随机出现权重；tier = 推荐炮档（仅 HUD 提示用）
// name 用 i18n key（config/locales.js 的 fish.1..fish.10）
export const FISHES = [
  { id: 1, key: 'lantern',    hp: 2,  value: 1,   radius: 16, speed: 74, weight: 18, tier: 1, boss: false },
  { id: 2, key: 'sardine',    hp: 2,  value: 1,   radius: 14, speed: 88, weight: 18, tier: 1, boss: false },
  { id: 3, key: 'butterfly',  hp: 3,  value: 2,   radius: 18, speed: 62, weight: 14, tier: 1, boss: false },
  { id: 4, key: 'grouper',    hp: 4,  value: 6,   radius: 22, speed: 54, weight: 5,  tier: 2, boss: false },
  { id: 5, key: 'lionfish',   hp: 5,  value: 10,  radius: 22, speed: 50, weight: 4,  tier: 2, boss: false },
  { id: 6, key: 'turtle',     hp: 6,  value: 14,  radius: 26, speed: 44, weight: 3,  tier: 3, boss: false },
  { id: 7, key: 'manta',      hp: 8,  value: 22,  radius: 34, speed: 40, weight: 2,  tier: 3, boss: false },
  { id: 8, key: 'hammerhead', hp: 10, value: 34,  radius: 30, speed: 48, weight: 2,  tier: 4, boss: false },
  { id: 9, key: 'oarfish',    hp: 12, value: 50,  radius: 28, speed: 36, weight: 1,  tier: 5, boss: false },
  { id: 10, key: 'megamouth', hp: 25, value: 300, radius: 52, speed: 22, weight: 0,  tier: 7, boss: true },
];

export const BOSS_FISH_ID = 10;

export function fishById(id) {
  return FISHES.find((f) => f.id === id) || FISHES[0];
}
