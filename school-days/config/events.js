// 事件表：本周结算中触发的随机/剧情事件。
// 字段：id / kind(good|bad|neutral) / titleKey / descKey / options[{ labelKey, effects }]
// effects 可含 coins/energy/mood/grades/fitness/reputation（作用于学校聚合属性）。
// scripted = 关卡表里 events 数组引用的事件；RANDOM_POOL 供无剧情事件的周 seeded 抽取。

export const EVENTS = {
  cold: {
    id: 'cold', kind: 'bad', titleKey: 'ev_cold_title', descKey: 'ev_cold_desc',
    options: [
      { labelKey: 'ev_cold_a', effects: { coins: -50, mood: 5 } },
      { labelKey: 'ev_cold_b', effects: { mood: -8 } },
    ],
  },
  gift: {
    id: 'gift', kind: 'good', titleKey: 'ev_gift_title', descKey: 'ev_gift_desc',
    options: [
      { labelKey: 'ev_gift_a', effects: { coins: 150 } },
      { labelKey: 'ev_gift_b', effects: { reputation: 8 } },
    ],
  },
  mischief: {
    id: 'mischief', kind: 'bad', titleKey: 'ev_mischief_title', descKey: 'ev_mischief_desc',
    options: [
      { labelKey: 'ev_mischief_a', effects: { coins: -30, reputation: 3, mood: -2 } },
      { labelKey: 'ev_mischief_b', effects: { mood: -6, reputation: -2 } },
    ],
  },
  talentFound: {
    id: 'talentFound', kind: 'good', titleKey: 'ev_talent_title', descKey: 'ev_talent_desc',
    options: [
      { labelKey: 'ev_talent_a', effects: { grades: 6, fitness: 4 } },
      { labelKey: 'ev_talent_b', effects: { mood: 6, reputation: 4 } },
    ],
  },
  riverTrip: {
    id: 'riverTrip', kind: 'good', titleKey: 'ev_river_title', descKey: 'ev_river_desc',
    options: [
      { labelKey: 'ev_river_a', effects: { coins: -80, reputation: 10, mood: 5 } },
      { labelKey: 'ev_river_b', effects: { grades: 4 } },
    ],
  },
  epidemic: {
    id: 'epidemic', kind: 'bad', titleKey: 'ev_epidemic_title', descKey: 'ev_epidemic_desc',
    options: [
      { labelKey: 'ev_epidemic_a', effects: { coins: -120, mood: 15 } },
      { labelKey: 'ev_epidemic_b', effects: { mood: -10, energy: -20 } },
    ],
  },
  festival: {
    id: 'festival', kind: 'good', titleKey: 'ev_festival_title', descKey: 'ev_festival_desc',
    options: [
      { labelKey: 'ev_festival_a', effects: { coins: -100, reputation: 12, mood: 3 } },
      { labelKey: 'ev_festival_b', effects: { reputation: -5 } },
    ],
  },
  stipend: {
    id: 'stipend', kind: 'good', titleKey: 'ev_stipend_title', descKey: 'ev_stipend_desc',
    options: [
      { labelKey: 'ev_stipend_a', effects: { coins: 200 } },
      { labelKey: 'ev_stipend_b', effects: { reputation: 6, mood: 3 } },
    ],
  },
  storm: {
    id: 'storm', kind: 'bad', titleKey: 'ev_storm_title', descKey: 'ev_storm_desc',
    options: [
      { labelKey: 'ev_storm_a', effects: { grades: 4 } },
      { labelKey: 'ev_storm_b', effects: { fitness: 6, mood: -4 } },
    ],
  },
};

// 无剧情事件的周（W8/W11 等）从池子里 seeded 抽 0-2 个
export const RANDOM_POOL = [
  { id: 'donation', kind: 'good', titleKey: 'ev_donation_title', descKey: 'ev_donation_desc',
    options: [
      { labelKey: 'ev_donation_a', effects: { coins: 120 } },
      { labelKey: 'ev_donation_b', effects: { reputation: 6 } },
    ] },
  { id: 'prank', kind: 'bad', titleKey: 'ev_prank_title', descKey: 'ev_prank_desc',
    options: [
      { labelKey: 'ev_prank_a', effects: { coins: -40, reputation: 4 } },
      { labelKey: 'ev_prank_b', effects: { mood: -8 } },
    ] },
  { id: 'visitor', kind: 'good', titleKey: 'ev_visitor_title', descKey: 'ev_visitor_desc',
    options: [
      { labelKey: 'ev_visitor_a', effects: { reputation: 8 } },
      { labelKey: 'ev_visitor_b', effects: { grades: 5 } },
    ] },
  { id: 'rainy', kind: 'bad', titleKey: 'ev_rainy_title', descKey: 'ev_rainy_desc',
    options: [
      { labelKey: 'ev_rainy_a', effects: { energy: -15, mood: -4 } },
      { labelKey: 'ev_rainy_b', effects: { coins: -30 } },
    ] },
];

export function eventById(id) {
  return EVENTS[id] || RANDOM_POOL.find((e) => e.id === id) || null;
}
