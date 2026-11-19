// 题目内容（Traffic Commute · 交通出行 1:1 玩法骨架 + 霓虹街机换皮）
// 规则事实表（源自参考源码 Constants.ts / LevelSelect.ts）：
//   两位出行者依次答题；每题 = 一个场景 + 若干可点选项；
//   点中任意正确选项 → 首答正确得星并进入下一题；点错 → 提示后原地重试（不前进）。
// 换皮后新增：每题倒计时、连击、提示令牌、星级评级（详见 design.json）。

// 出行者（原：小明步行 / 小朋乘车 → 换皮：Mia 步行 / Leo 乘公交）
export const TRAVELERS = [
  { id: 0, name: 'Mia', nameKey: 'travelerMia', modeKey: 'walk', emoji: '🚶' },
  { id: 1, name: 'Leo', nameKey: 'travelerLeo', modeKey: 'ride', emoji: '🚌' },
];

// 题目：options 的 x/y 为场景区内的归一化坐标（0~1），render 据此摆放标记
export const TOPICS = [
  // ---- Mia 步行（3 题）----
  {
    id: 0,
    traveler: 0,
    scene: 'road',
    titleKey: 'q_walk_1',
    correct: [0],
    options: [
      { i: 0, x: 0.27, y: 0.60, labelKey: 'optCrosswalk', icon: 'crosswalk' },
      { i: 1, x: 0.73, y: 0.60, labelKey: 'optJaywalk', icon: 'jaywalk' },
    ],
  },
  {
    id: 1,
    traveler: 0,
    scene: 'lights',
    titleKey: 'q_walk_2',
    correct: [0],
    options: [
      { i: 0, x: 0.22, y: 0.60, labelKey: 'optSignalWalk', icon: 'signalWalk' },
      { i: 1, x: 0.50, y: 0.60, labelKey: 'optSignalStop', icon: 'signalStop' },
      { i: 2, x: 0.78, y: 0.60, labelKey: 'optSignalWait', icon: 'signalWait' },
    ],
  },
  {
    id: 2,
    traveler: 0,
    scene: 'bridge',
    titleKey: 'q_walk_3',
    correct: [0],
    options: [
      { i: 0, x: 0.30, y: 0.56, labelKey: 'optBridge', icon: 'bridge' },
      { i: 1, x: 0.70, y: 0.56, labelKey: 'optJaywalk', icon: 'jaywalk' },
    ],
  },

  // ---- Leo 乘车（4 题）----
  {
    id: 3,
    traveler: 1,
    scene: 'busstop',
    titleKey: 'q_ride_1',
    correct: [1],
    options: [
      { i: 0, x: 0.28, y: 0.58, labelKey: 'optTruck', icon: 'truck' },
      { i: 1, x: 0.72, y: 0.58, labelKey: 'optBus', icon: 'bus' },
    ],
  },
  {
    id: 4,
    traveler: 1,
    scene: 'businterior',
    titleKey: 'q_ride_2',
    correct: [1],
    options: [
      { i: 0, x: 0.22, y: 0.58, labelKey: 'optStand', icon: 'stand' },
      { i: 1, x: 0.50, y: 0.58, labelKey: 'optSeatbelt', icon: 'seatbelt' },
      { i: 2, x: 0.78, y: 0.58, labelKey: 'optDoor', icon: 'door' },
    ],
  },
  {
    id: 5,
    traveler: 1,
    scene: 'businterior',
    titleKey: 'q_ride_3',
    correct: [0],
    options: [
      { i: 0, x: 0.22, y: 0.58, labelKey: 'optHandrail', icon: 'handrail' },
      { i: 1, x: 0.50, y: 0.58, labelKey: 'optLeanout', icon: 'leanout' },
      { i: 2, x: 0.78, y: 0.58, labelKey: 'optRun', icon: 'run' },
    ],
  },
  {
    id: 6,
    traveler: 1,
    scene: 'curb',
    titleKey: 'q_ride_4',
    correct: [1],
    options: [
      { i: 0, x: 0.28, y: 0.58, labelKey: 'optRoadside', icon: 'roadside' },
      { i: 1, x: 0.72, y: 0.58, labelKey: 'optCurb', icon: 'curb' },
    ],
  },
];

export const QUESTION_COUNT = TOPICS.length;

export function topicsFor(travelerId) {
  return TOPICS.filter((t) => t.traveler === travelerId);
}

export function travelerById(id) {
  return TRAVELERS.find((t) => t.id === id) || TRAVELERS[0];
}
