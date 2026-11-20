// CAKE KART · 12 站翻糖大奖赛（GP）定义
// 每站：赛道形状参数 + 三场景包之一 + 圈数 2→3 + 地形区间（果冻加速带/巧克力泥减速区/窄桥）。
// 赛道几何由 src/game/track.js 依据 shape 参数确定性生成（同站同赛道）。

// 场景包索引 → i18n key
export const SCENE_KEY = { 1: 'scene.1', 2: 'scene.2', 3: 'scene.3' };

// 每站一个：推进结构（弯道轮换 / 长直 / 泥区 / 窄桥）+ AI 速度递进 + 圈数 2→3
export const STATIONS = [
  {
    index: 1,
    scene: 1,
    laps: 2,
    newElement: '翻糖平原 · 缓弯椭圆（教油门与转向）',
    shape: { radius: 560, lobes: 2, wobble: 0.08, seed: 11, jelly: [[0.28, 0.40]], mud: [], bridge: [] },
  },
  {
    index: 2,
    scene: 1,
    laps: 2,
    newElement: 'S 形连续弯 + 果冻加速带（教走线）',
    shape: { radius: 560, lobes: 3, wobble: 0.16, seed: 22, jelly: [[0.15, 0.28], [0.55, 0.68]], mud: [], bridge: [] },
  },
  {
    index: 3,
    scene: 1,
    laps: 2,
    newElement: '双急弯 + 双果冻带（教漂移蓄力）',
    shape: { radius: 560, lobes: 4, wobble: 0.22, seed: 33, jelly: [[0.35, 0.45], [0.75, 0.85]], mud: [], bridge: [] },
  },
  {
    index: 4,
    scene: 2,
    laps: 2,
    newElement: '巧克力谷 · 巧克力泥减速区（泥区漂移更难）',
    shape: { radius: 560, lobes: 3, wobble: 0.20, seed: 44, jelly: [], mud: [[0.50, 0.72]], bridge: [] },
  },
  {
    index: 5,
    scene: 2,
    laps: 2,
    newElement: '发卡急弯 + 泥区（满蓄漂移风险化）',
    shape: { radius: 560, lobes: 5, wobble: 0.30, seed: 55, jelly: [[0.10, 0.22]], mud: [[0.62, 0.82]], bridge: [] },
  },
  {
    index: 6,
    scene: 2,
    laps: 3,
    newElement: '窄桥路段（半宽收窄，碰撞风险）',
    shape: { radius: 560, lobes: 3, wobble: 0.18, seed: 66, jelly: [[0.30, 0.42]], mud: [], bridge: [[0.68, 0.86]] },
  },
  {
    index: 7,
    scene: 1,
    laps: 3,
    newElement: '长直道 + 连续果冻带（极速 + 道具战）',
    shape: { radius: 560, lobes: 2, wobble: 0.06, seed: 77, jelly: [[0.10, 0.55]], mud: [], bridge: [] },
  },
  {
    index: 8,
    scene: 2,
    laps: 3,
    newElement: '巧克力谷 · 泥区夹窄桥（减速 + 变窄组合）',
    shape: { radius: 560, lobes: 4, wobble: 0.24, seed: 88, jelly: [], mud: [[0.25, 0.45]], bridge: [[0.55, 0.70]] },
  },
  {
    index: 9,
    scene: 3,
    laps: 3,
    newElement: '冰淇淋峰 · 高曲率连续急弯',
    shape: { radius: 560, lobes: 6, wobble: 0.34, seed: 99, jelly: [[0.20, 0.32]], mud: [], bridge: [] },
  },
  {
    index: 10,
    scene: 3,
    laps: 3,
    newElement: '冰淇淋峰 · 冰面窄桥（漂移外滑加剧）',
    shape: { radius: 560, lobes: 5, wobble: 0.28, seed: 111, jelly: [[0.45, 0.58]], mud: [], bridge: [[0.70, 0.90]] },
  },
  {
    index: 11,
    scene: 3,
    laps: 3,
    newElement: '混合险境：泥区 + 窄桥 + 果冻带',
    shape: { radius: 560, lobes: 5, wobble: 0.30, seed: 122, jelly: [[0.08, 0.20]], mud: [[0.38, 0.56]], bridge: [[0.66, 0.80]] },
  },
  {
    index: 12,
    scene: 3,
    laps: 3,
    newElement: '终站 · 全部险境齐上 + AI 全速',
    shape: { radius: 560, lobes: 7, wobble: 0.36, seed: 133, jelly: [[0.12, 0.24], [0.55, 0.66]], mud: [[0.30, 0.48]], bridge: [[0.74, 0.92]] },
  },
];

export const STATION_COUNT = STATIONS.length;

export function stationAt(n) {
  const i = Math.max(0, Math.min(STATION_COUNT - 1, Math.round(n || 1) - 1));
  return STATIONS[i];
}
