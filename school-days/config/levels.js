// 12 周（12 关）推进结构。字段：
//   index    周次（1 基）
//   scene    场景包：spring(春日山舍) / summer(夏夜萤院) / winter(冬雪书馆)
//   goal     本周目标 { attr, threshold }：结算时该属性学校均值 ≥ threshold 即达标
//   feature  本周特性（规则变化），供 sim 判定与 UI 展示
//   events   本周必发事件 id 列表（config/events.js），可为空；generic 周会另从池子里 seeded 抽 0-2 个
//   newElement 教学提示文案 key（设计源已登记）
export const LEVELS = [
  { index: 1, scene: 'spring', goal: { attr: 'grades', threshold: 40 }, feature: 'regular', events: [], newElement: 'newEl1' },
  { index: 2, scene: 'spring', goal: { attr: 'fitness', threshold: 38 }, feature: 'energyTight', events: ['cold'], newElement: 'newEl2' },
  { index: 3, scene: 'spring', goal: { attr: 'mood', threshold: 55 }, feature: 'doubleEvent', events: ['gift', 'mischief'], newElement: 'newEl3' },
  { index: 4, scene: 'spring', goal: { attr: 'grades', threshold: 50 }, feature: 'talent', events: ['talentFound'], newElement: 'newEl4' },
  { index: 5, scene: 'summer', goal: { attr: 'reputation', threshold: 40 }, feature: 'studyWindow', events: ['riverTrip'], newElement: 'newEl5' },
  { index: 6, scene: 'summer', goal: { attr: 'mood', threshold: 50 }, feature: 'epidemic', events: ['epidemic'], newElement: 'newEl6' },
  { index: 7, scene: 'summer', goal: { attr: 'reputation', threshold: 50 }, feature: 'festival', events: ['festival'], newElement: 'newEl7' },
  { index: 8, scene: 'summer', goal: { attr: 'fitness', threshold: 55 }, feature: 'energyCap', events: [], newElement: 'newEl8' },
  { index: 9, scene: 'winter', goal: { attr: 'grades', threshold: 60 }, feature: 'cram', events: ['stipend'], newElement: 'newEl9' },
  { index: 10, scene: 'winter', goal: { attr: 'reputation', threshold: 55 }, feature: 'storm', events: ['storm'], newElement: 'newEl10' },
  { index: 11, scene: 'winter', goal: { attr: 'grades', threshold: 65 }, feature: 'mockExam', events: [], newElement: 'newEl11' },
  { index: 12, scene: 'winter', goal: { attr: 'grades', threshold: 70 }, feature: 'final', events: [], newElement: 'newEl12' },
];

export const LEVEL_COUNT = LEVELS.length;

export function levelOf(week) {
  return LEVELS[Math.max(0, Math.min(LEVEL_COUNT - 1, (week | 0) - 1))] || LEVELS[0];
}
