// FOOD CHAIN · 12 阶段推进结构 + 三场景包（光合带 / 中层带 / 热泉带）
// stage: 0..11（12 阶段）；massTarget 为累计质量阈值；radius 为生物半径。
// zone: 0 光合带（亮青）/ 1 中层带（深蓝）/ 2 热泉带（暗红）——换章必换色板+构图+装饰。
// ecology: 该阶段的生态轮换（毒刺鱼占比 / 大鱼密度 / 水母出现率 / 暗流区）。

export const STAGES = [
  { stage: 0,  massTarget: 0,    radius: 9,  speed: 1.0,  zone: 0, color: '#7ff7ff', ecology: { toxicRatio: 0.0, predatorBias: 0.10, jellyRate: 0.0, current: false } },
  { stage: 1,  massTarget: 20,   radius: 13, speed: 0.97, zone: 0, color: '#6ee7ff', ecology: { toxicRatio: 0.0, predatorBias: 0.14, jellyRate: 0.0, current: false } },
  { stage: 2,  massTarget: 55,   radius: 17, speed: 0.94, zone: 0, color: '#59d8ff', ecology: { toxicRatio: 0.10, predatorBias: 0.18, jellyRate: 0.0, current: false } },
  { stage: 3,  massTarget: 105,  radius: 21, speed: 0.91, zone: 0, color: '#3fc9ff', ecology: { toxicRatio: 0.14, predatorBias: 0.22, jellyRate: 0.0, current: false } },
  { stage: 4,  massTarget: 170,  radius: 25, speed: 0.88, zone: 1, color: '#8f9bff', ecology: { toxicRatio: 0.16, predatorBias: 0.26, jellyRate: 0.05, current: false } },
  { stage: 5,  massTarget: 250,  radius: 29, speed: 0.85, zone: 1, color: '#7c8cff', ecology: { toxicRatio: 0.18, predatorBias: 0.30, jellyRate: 0.06, current: false } },
  { stage: 6,  massTarget: 345,  radius: 33, speed: 0.82, zone: 1, color: '#6a7dff', ecology: { toxicRatio: 0.20, predatorBias: 0.34, jellyRate: 0.07, current: false } },
  { stage: 7,  massTarget: 455,  radius: 37, speed: 0.79, zone: 1, color: '#5a6cff', ecology: { toxicRatio: 0.21, predatorBias: 0.38, jellyRate: 0.08, current: false } },
  { stage: 8,  massTarget: 580,  radius: 42, speed: 0.76, zone: 2, color: '#ff8a6b', ecology: { toxicRatio: 0.23, predatorBias: 0.42, jellyRate: 0.09, current: true } },
  { stage: 9,  massTarget: 720,  radius: 47, speed: 0.74, zone: 2, color: '#ff6f5a', ecology: { toxicRatio: 0.25, predatorBias: 0.46, jellyRate: 0.10, current: true } },
  { stage: 10, massTarget: 875,  radius: 52, speed: 0.72, zone: 2, color: '#ff5548', ecology: { toxicRatio: 0.26, predatorBias: 0.50, jellyRate: 0.11, current: true } },
  { stage: 11, massTarget: 1050, radius: 58, speed: 0.70, zone: 2, color: '#ff3b38', ecology: { toxicRatio: 0.27, predatorBias: 0.52, jellyRate: 0.12, current: true } },
];

export const STAGE_COUNT = STAGES.length;
export const FINAL_STAGE = STAGE_COUNT - 1;

// mass → stage（累计阈值单调递增）
export function stageAt(mass) {
  let s = 0;
  for (let i = 0; i < STAGE_COUNT; i += 1) {
    if (mass >= STAGES[i].massTarget) s = i;
  }
  return s;
}

export function stageDef(stage) {
  return STAGES[Math.max(0, Math.min(STAGE_COUNT - 1, stage))];
}

export function radiusAt(stage) {
  return stageDef(stage).radius;
}

export function zoneAtStage(stage) {
  return stageDef(stage).zone;
}

export function colorAtStage(stage) {
  return stageDef(stage).color;
}

// 该阶段进化所需的下一个质量目标（已到顶则返回当前目标）
export function nextMassTarget(mass) {
  const s = stageAt(mass);
  if (s >= FINAL_STAGE) return STAGES[s].massTarget;
  return STAGES[s + 1].massTarget;
}
