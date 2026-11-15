// src/game/track.js — 纯逻辑赛道：直线沿 +Z 前进，段内线性插值高度/宽度。
// 不依赖 THREE/DOM，node 可测。渲染层用同一份 segments 建 mesh。
export function createTrack(level) {
  const segs = level.segments.map((s) => ({ ...s }));
  const first = segs[0];
  const last = segs[segs.length - 1];

  function segAt(z) {
    for (const s of segs) {
      if (z >= s.from && z <= s.to) return s;
    }
    return z < first.from ? first : last;
  }

  function surfaceY(z) {
    const s = segAt(z);
    const t = (z - s.from) / (s.to - s.from || 1);
    return s.y0 + (s.y1 - s.y0) * Math.max(0, Math.min(1, t));
  }

  function halfWidthAt(z) {
    const s = segAt(z);
    return s.width;
  }

  // 沿轨坡度（+ 上坡 / - 下坡）
  function slopeAt(z) {
    const s = segAt(z);
    if (s.to === s.from) return 0;
    return (s.y1 - s.y0) / (s.to - s.from);
  }

  return {
    index: level.index,
    name: level.name,
    length: level.length,
    targetSec: level.targetSec,
    spawn: level.spawn,
    segs,
    surfaceY,
    halfWidthAt,
    slopeAt,
  };
}
