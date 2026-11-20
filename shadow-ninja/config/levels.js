// Shadow Ninja Cat · 关卡数据（Lead 拥有）
// 契约：docs/README.md。字段：index/scene/name/length(格数)/speed(px/s)/
//       chimeGoal(风铃目标)/features(本关机制开关)/newElement(新增元素)。
// features: spike(尖刺) enemy(敌忍) shuriken(飞镖) dog(追击犬) highLow(高低双层)
//            bellChain(风铃链) fog(夜雾) glide(滑索) dense(密集) wideGap(宽沟)
// 关卡由 sim 用 seed 确定性生成；前 3 关保证可被 greedy bot 稳定通关。

export const LEVELS = [
  {
    index: 1, scene: 'dusk-tiles', length: 55, speed: 340, chimeGoal: 6,
    name: { en: 'First Rooftop', zh: '初登瓦海' },
    features: {},
    newElement: '基本跳跃：越过瓦檐断口',
  },
  {
    index: 2, scene: 'dusk-tiles', length: 62, speed: 360, chimeGoal: 7,
    name: { en: 'Spiked Eaves', zh: '尖刺檐' },
    features: { spike: true },
    newElement: '尖刺檐：落地前必须跳过尖刺',
  },
  {
    index: 3, scene: 'dusk-tiles', length: 68, speed: 390, chimeGoal: 8,
    name: { en: 'Shuriken Volley', zh: '飞镖阵' },
    features: { spike: true, enemy: true, shuriken: true },
    newElement: '飞镖阵：跳起会撞上飞镖，学会俯冲/贴地',
  },
  {
    index: 4, scene: 'dusk-tiles', length: 74, speed: 410, chimeGoal: 9,
    name: { en: 'The Chasing Dog', zh: '追击犬' },
    features: { spike: true, enemy: true, shuriken: true, dog: true },
    newElement: '追击犬：区间内强制加速',
  },
  {
    index: 5, scene: 'rain-alley', length: 78, speed: 430, chimeGoal: 10,
    name: { en: 'High & Low Lanes', zh: '高低双层' },
    features: { spike: true, enemy: true, shuriken: true, highLow: true },
    newElement: '高低双层：上层有风铃，下层更安全',
  },
  {
    index: 6, scene: 'rain-alley', length: 82, speed: 445, chimeGoal: 12,
    name: { en: 'Wind-Chime Chain', zh: '风铃链' },
    features: { spike: true, enemy: true, shuriken: true, highLow: true, bellChain: true },
    newElement: '风铃链：连续风铃挂在险路上',
  },
  {
    index: 7, scene: 'rain-alley', length: 86, speed: 455, chimeGoal: 13,
    name: { en: 'Night Fog', zh: '夜雾段' },
    features: { spike: true, enemy: true, shuriken: true, fog: true },
    newElement: '夜雾段：能见度下降',
  },
  {
    index: 8, scene: 'rain-alley', length: 90, speed: 465, chimeGoal: 14,
    name: { en: 'Rooftop Zip-line', zh: '滑索段' },
    features: { spike: true, enemy: true, shuriken: true, glide: true },
    newElement: '滑索段：自动滑行吃风铃',
  },
  {
    index: 9, scene: 'moon-bamboo', length: 92, speed: 475, chimeGoal: 15,
    name: { en: 'Bamboo Crossfire', zh: '竹林合围' },
    features: { spike: true, enemy: true, shuriken: true, highLow: true, dog: true },
    newElement: '复合地形：尖刺+飞镖+追击犬',
  },
  {
    index: 10, scene: 'moon-bamboo', length: 96, speed: 485, chimeGoal: 16,
    name: { en: 'Dense Peril', zh: '险象环生' },
    features: { spike: true, enemy: true, shuriken: true, wideGap: true, dense: true },
    newElement: '密集陷阱：宽沟与连刺',
  },
  {
    index: 11, scene: 'moon-bamboo', length: 104, speed: 495, chimeGoal: 18,
    name: { en: 'Long Night', zh: '长夜奔袭' },
    features: { spike: true, enemy: true, shuriken: true, highLow: true, fog: true, wideGap: true },
    newElement: '超长距离：耐心与节奏',
  },
  {
    index: 12, scene: 'moon-bamboo', length: 110, speed: 505, chimeGoal: 20,
    name: { en: 'Daimyo Castle', zh: '大名居城' },
    features: { spike: true, enemy: true, shuriken: true, highLow: true, dog: true, fog: true, wideGap: true, dense: true, bellChain: true },
    newElement: '终章三轴叠加：飞镖+追击犬+风铃链',
  },
];

export const LEVEL_COUNT = LEVELS.length;
