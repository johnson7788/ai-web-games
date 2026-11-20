// BEAT BALL · 关卡数据（12 关 3 场景逐字落实）
// 字段：index/scene/bpm/beats/lanes/warnBeats/hazardProb/padProb/targetCombo/feature/newElement/name
// feature 驱动 sim/render 的新机制；newElement 是给 fun-audit 看的机器可读新元素描述。
// 节奏：关内恒定 BPM（90→140 递增），障碍生成与节拍锁定，seeded 可复现。
// 场景包：dawn（晨光祭道）/ lantern（灯笼夜祭）/ storm（雷雨祭台）。

export const LEVELS = [
  {
    index: 1, scene: 'dawn', bpm: 90, beats: 40,
    lanes: 1, warnBeats: 2, hazardProb: 0.22, padProb: 0.5, targetCombo: 3,
    feature: 'singleRail',
    newElement: '单轨：只有一条鼓道，学会踩拍与跳跃避槌',
    name: { en: 'Dawn Procession', zh: '晨光单轨' },
  },
  {
    index: 2, scene: 'dawn', bpm: 95, beats: 45,
    lanes: 2, warnBeats: 2, hazardProb: 0.26, padProb: 0.55, targetCombo: 4,
    feature: 'doubleRail',
    newElement: '双轨：左右变道，第一次横移取舍',
    name: { en: 'Twin Rails', zh: '双轨祭道' },
  },
  {
    index: 3, scene: 'dawn', bpm: 100, beats: 50,
    lanes: 3, warnBeats: 2, hazardProb: 0.28, padProb: 0.6, targetCombo: 5,
    feature: 'tripleRail',
    newElement: '三轨：三线横移，抢拍要提前判断',
    name: { en: 'Three Drums', zh: '三轨齐鸣' },
  },
  {
    index: 4, scene: 'dawn', bpm: 105, beats: 55,
    lanes: 3, warnBeats: 3, hazardProb: 0.3, padProb: 0.6, targetCombo: 6,
    feature: 'drumWarning',
    newElement: '鼓槌预警：红圈提前三拍亮起，更早读节奏',
    name: { en: 'Stick Warning', zh: '鼓槌预警' },
  },
  {
    index: 5, scene: 'lantern', bpm: 110, beats: 60,
    lanes: 3, warnBeats: 2, hazardProb: 0.32, padProb: 0.6, targetCombo: 7,
    feature: 'doubleStick',
    newElement: '双槌交替：同一拍两根槌落下，只留一条安全轨',
    name: { en: 'Twin Sticks', zh: '双槌交替' },
  },
  {
    index: 6, scene: 'lantern', bpm: 112, beats: 62,
    lanes: 3, warnBeats: 2, hazardProb: 0.26, padProb: 0.62, targetCombo: 8,
    feature: 'jumpPad',
    newElement: '跳板段：发光鼓边需跳跃踩中，落地即双倍分',
    name: { en: 'Rim Bounce', zh: '跳板弹起' },
  },
  {
    index: 7, scene: 'lantern', bpm: 114, beats: 64, bpm2: 132, shiftBeat: 32,
    lanes: 3, warnBeats: 2, hazardProb: 0.3, padProb: 0.6, targetCombo: 9,
    feature: 'tempoShift',
    newElement: '变速段：BPM 中段骤升，节拍时钟加速',
    name: { en: 'Tempo Shift', zh: '变速急行' },
  },
  {
    index: 8, scene: 'lantern', bpm: 118, beats: 66,
    lanes: 3, warnBeats: 2, hazardProb: 0.3, padProb: 0.58, targetCombo: 10,
    feature: 'fog',
    newElement: '迷雾段：预警红圈半透明，靠听拍和记忆躲槌',
    name: { en: 'Fog Drift', zh: '迷雾灯笼' },
  },
  {
    index: 9, scene: 'storm', bpm: 120, beats: 68,
    lanes: 3, warnBeats: 2, hazardProb: 0.22, padProb: 0.8, targetCombo: 12,
    feature: 'padStorm',
    newElement: '鼓点连击：节拍点密集，连踩风暴刷分',
    name: { en: 'Beat Storm', zh: '鼓点连击' },
  },
  {
    index: 10, scene: 'storm', bpm: 125, beats: 70,
    lanes: 3, warnBeats: 2, hazardProb: 0.34, padProb: 0.6, targetCombo: 14,
    feature: 'crossSticks',
    newElement: '左右开弓：鼓槌在相邻轨间快速交替落下',
    name: { en: 'Cross Sticks', zh: '左右开弓' },
  },
  {
    index: 11, scene: 'storm', bpm: 130, beats: 72,
    lanes: 3, warnBeats: 1, hazardProb: 0.28, padProb: 0.6, targetCombo: 16,
    feature: 'storm',
    newElement: '雷雨加速：预警只剩一拍，反应时间被压缩',
    name: { en: 'Thunder Dash', zh: '雷雨急降' },
  },
  {
    index: 12, scene: 'storm', bpm: 140, beats: 78,
    lanes: 3, warnBeats: 2, hazardProb: 0.4, padProb: 0.72, targetCombo: 20,
    feature: 'doubleDrum',
    newElement: '双鼓对撞：终章双槌夹击 + 鼓点密布的收官风暴',
    name: { en: 'Twin Drums', zh: '双鼓对撞' },
  },
];

export const LEVEL_COUNT = LEVELS.length;
