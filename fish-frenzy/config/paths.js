// FISH FRENZY · 鱼群路径表（折线控制点，世界坐标 y 在 0..720，x 可出屏）
// 每条路径 = 从屏幕一侧游到另一侧；鱼沿折线匀速游动（见 src/game/spawner.js moveFish）
// lane 供鱼汛预报显示用（HUD/渲染读取）
export const PATHS = [
  { id: 1, lane: 'top',       points: [[-70, 118], [330, 172], [660, 118], [990, 176], [1350, 138]] },
  { id: 2, lane: 'mid',       points: [[-70, 296], [300, 356], [660, 296], [980, 358], [1350, 312]] },
  { id: 3, lane: 'mid-back',  points: [[1350, 210], [990, 156], [660, 220], [300, 164], [-70, 212]] },
  { id: 4, lane: 'high',      points: [[-70, 86], [330, 42], [660, 108], [990, 48], [1350, 92]] },
  { id: 5, lane: 'arc-low',   points: [[-70, 420], [410, 300], [720, 300], [1030, 424], [1350, 430]] },
  { id: 6, lane: 'arc-low-r', points: [[1350, 424], [1030, 300], [720, 300], [410, 424], [-70, 428]] },
];

export function pathById(id) {
  return PATHS.find((p) => p.id === id) || PATHS[0];
}
