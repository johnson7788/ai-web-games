// src/game/track.js — 纯逻辑 3D 环形赛道：闭合参数环 + 高程剖面 → 环序列。
// 不依赖 THREE/DOM，node 可测。sim 与 render 共用同一份 ring 数据。
// 每环：{ bx,by,bz 基础中心, nx,ny,nz 前向法线, radius 判定半径, moveAmp/moveFreq/phase }。

function wrap(a) {
  const T = Math.PI * 2;
  const v = ((a % T) + T) % T; // [0, 2π)
  return v > Math.PI ? v - T : v; // 归一化到 [-π, π)
}

export function createCourse(def) {
  const N = def.ringCount;
  const rings = [];
  for (let i = 0; i < N; i++) {
    const u = i / N;
    const a = u * Math.PI * 2;
    const r = def.loopR * (1 + (def.wobbleAmp || 0) * Math.sin(3 * a + 0.7));
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    let y = def.baseY + (def.elevAmp || 0) * Math.sin(2 * a + 1.3);
    if (def.diveDepth) y -= def.diveDepth * Math.max(0, Math.sin(a + (def.divePhase || 0)));
    let radius = def.ringRadius;
    if (def.sprintRings && i >= N - def.sprintRings) radius = def.sprintRadius;
    rings.push({
      index: i, bx: x, by: y, bz: z, radius,
      moveAmp: def.moveAmp || 0, moveFreq: def.moveFreq || 0, phase: i * 1.7,
      nx: 0, ny: 0, nz: 0,
    });
  }
  // 数值切向法线
  let length = 0;
  for (let i = 0; i < N; i++) {
    const a = rings[(i - 1 + N) % N], b = rings[(i + 1) % N];
    let tx = b.bx - a.bx, ty = b.by - a.by, tz = b.bz - a.bz;
    const L = Math.hypot(tx, ty, tz) || 1;
    rings[i].nx = tx / L; rings[i].ny = ty / L; rings[i].nz = tz / L;
    const c = rings[i], d = rings[(i + 1) % N];
    length += Math.hypot(d.bx - c.bx, d.by - c.by, d.bz - c.bz);
  }
  return { rings, ringCount: N, length, variant: def.variant || 'base' };
}

// 动态环中心（移动环上下浮动）
export function ringCenter(track, i, time) {
  const r = track.rings[i];
  const dy = r.moveAmp ? r.moveAmp * Math.sin(time * r.moveFreq * Math.PI * 2 + r.phase) : 0;
  return { x: r.bx, y: r.by + dy, z: r.bz };
}

// 有符号距离：点相对环平面的前后
export function signedD(pos, ring) {
  return (pos.x - ring.x) * ring.nx + (pos.y - ring.y) * ring.ny + (pos.z - ring.z) * ring.nz;
}

export { wrap };
