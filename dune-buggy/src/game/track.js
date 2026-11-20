// DUNE BUGGY · 赛道生成（纯逻辑，确定性）：每段 { curve, y, terrain, ridge, ridgeX }
// curve：弯道（弧度，正值把车向外甩）；y：沙丘起伏（米）；terrain：sand|rock|ridge|jump|oasis
// ridge：该段是否覆盖金色沙脊；ridgeX：沙脊中心横向位置（-1..1，通常 0，双脊岔路为 ±0.34）
import { STAGE } from '../../config/gameplay.js';
import { mulberry32 } from './rng.js';

const SEG_LEN = STAGE.SEG_LEN;

export function buildTrack(stage, seed) {
  const rng = mulberry32((seed ^ (stage.index * 2654435761)) >>> 0);
  const n = Math.max(40, Math.ceil(stage.length / SEG_LEN));
  const segments = new Array(n);

  let terrain = 'sand';
  let rockRun = 0;
  let oasisRun = 0;
  let ridgeRun = 0;
  let ridge = false;

  for (let i = 0; i < n; i += 1) {
    // 弯道：两路正弦叠加 + 噪声（gentle S 弯，bot 可稳定走线）
    const curve =
      Math.sin(i * 0.018 + stage.index * 1.3) * stage.curveAmp * 0.62 +
      Math.sin(i * 0.082 + stage.index * 2.3) * stage.curveAmp * 0.48 +
      (rng() - 0.5) * stage.curveAmp * 0.5;

    // 沙丘起伏（地平线起伏来源；保持道路可见，仅偶尔贴近镜头形成沙脊线）
    const y =
      Math.sin(i * 0.045 + stage.index * 1.7) * 0.55 +
      Math.sin(i * 0.11 + stage.index) * 0.32;

    // 地形分段（岩区 / 绿洲成块出现）
    if (rockRun > 0) { terrain = 'rock'; rockRun -= 1; }
    else if (oasisRun > 0) { terrain = 'oasis'; oasisRun -= 1; }
    else {
      terrain = 'sand';
      const roll = rng();
      if (stage.rockChance && roll < stage.rockChance * 0.42) { terrain = 'rock'; rockRun = 6 + Math.floor(rng() * 10); }
      else if (stage.oasisChance && roll < stage.rockChance * 0.42 + stage.oasisChance) { terrain = 'oasis'; oasisRun = 5 + Math.floor(rng() * 8); }
    }

    // 绿洲跳台（孤立段）
    if (stage.jumpChance && rng() < stage.jumpChance * 0.14) terrain = 'jump';

    // 金色沙脊（连续长条，便于骑行）
    if (ridgeRun > 0) { ridge = true; ridgeRun -= 1; }
    else if (stage.ridgeChance && rng() < stage.ridgeChance * 0.42) { ridge = true; ridgeRun = 9 + Math.floor(rng() * 14); }
    else ridge = false;

    const ridgeX = stage.twin ? (i % 2 === 0 ? -0.34 : 0.34) : 0;

    segments[i] = { curve, y, terrain, ridge, ridgeX };
  }

  return segments;
}

// 检查点距离（米）
export function buildCheckpoints(length) {
  const list = [];
  for (let d = STAGE.CHECKPOINT_EVERY; d < length; d += STAGE.CHECKPOINT_EVERY) list.push(d);
  return list;
}

export function segmentAt(segments, position) {
  const idx = Math.floor(position / SEG_LEN);
  return segments[Math.max(0, Math.min(segments.length - 1, idx))] || segments[0];
}
