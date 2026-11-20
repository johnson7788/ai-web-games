// src/render/trackmap.js — 把赛道画成俯视贴图（1024×1024），供 Mode7 采样。
// 场景切换时重画一次（换章必换色板）。
import { WORLD, scene } from './theme.js';
import { ITEM } from '../../config/gameplay.js';

const TEX = 1024;
const HALF = WORLD.MAP_SIZE / 2;      // 1024 世界单位
const SCALE = WORLD.MAP_SIZE / TEX;   // 2 世界单位 / 纹素

function tx(x) { return (x + HALF) / SCALE; }
function ty(y) { return (y + HALF) / SCALE; }

// 简易确定性 PRNG（装饰点用，与逻辑 rng 分离）
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 画一个四边形（纹理空间） */
function quad(ctx, a, b, c, d, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(tx(a[0]), ty(a[1]));
  ctx.lineTo(tx(b[0]), ty(b[1]));
  ctx.lineTo(tx(c[0]), ty(c[1]));
  ctx.lineTo(tx(d[0]), ty(d[1]));
  ctx.closePath();
  ctx.fill();
}

export function renderTrackMap(track, sceneIdx) {
  const sc = scene(sceneIdx);
  const canvas = document.createElement('canvas');
  canvas.width = TEX;
  canvas.height = TEX;
  const ctx = canvas.getContext('2d');

  // 背景
  ctx.fillStyle = sc.ground;
  ctx.fillRect(0, 0, TEX, TEX);

  // 装饰糖粒（先画，赛道会覆盖其上）
  const rnd = lcg(9000 + sceneIdx * 7);
  for (let i = 0; i < 520; i += 1) {
    const x = (rnd() - 0.5) * (WORLD.MAP_SIZE - 60);
    const y = (rnd() - 0.5) * (WORLD.MAP_SIZE - 60);
    ctx.fillStyle = sc.groundDot;
    ctx.beginPath();
    ctx.arc(tx(x), ty(y), (rnd() * 3 + 1) * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const N = track.samples.length;
  // 左/右边缘点（世界坐标）
  const edges = track.samples.map((s) => {
    const nx = -Math.sin(s.angle);
    const ny = Math.cos(s.angle);
    return {
      lx: s.x + nx * s.halfWidth, ly: s.y + ny * s.halfWidth,
      rx: s.x - nx * s.halfWidth, ry: s.y - ny * s.halfWidth,
    };
  });
  // 加宽的护栏路缘点（在赛道外画一圈深色路缘，明确赛道边界）
  const curbs = track.samples.map((s) => {
    const nx = -Math.sin(s.angle);
    const ny = Math.cos(s.angle);
    const w = s.halfWidth + 7;
    return {
      lx: s.x + nx * w, ly: s.y + ny * w,
      rx: s.x - nx * w, ry: s.y - ny * w,
    };
  });

  // 护栏路缘（深色，先画，赛道盖在上面形成清晰边界）
  for (let i = 0; i < N; i += 1) {
    const j = (i + 1) % N;
    const a = curbs[i];
    const b = curbs[j];
    quad(ctx, [a.lx, a.ly], [b.lx, b.ly], [b.rx, b.ry], [a.rx, a.ry], sc.barrier);
  }

  // 赛道面
  for (let i = 0; i < N; i += 1) {
    const j = (i + 1) % N;
    const a = edges[i];
    const b = edges[j];
    quad(ctx, [a.lx, a.ly], [b.lx, b.ly], [b.rx, b.ry], [a.rx, a.ry], sc.track);
  }

  // 果冻加速带（亮色覆盖）
  for (let i = 0; i < N; i += 1) {
    const s = track.samples[i];
    if (!s.jelly) continue;
    const j = (i + 1) % N;
    const a = edges[i];
    const b = edges[j];
    quad(ctx, [a.lx, a.ly], [b.lx, b.ly], [b.rx, b.ry], [a.rx, a.ry], sc.jelly);
  }

  // 巧克力泥减速区（暗色覆盖）
  for (let i = 0; i < N; i += 1) {
    const s = track.samples[i];
    if (!s.mud) continue;
    const j = (i + 1) % N;
    const a = edges[i];
    const b = edges[j];
    quad(ctx, [a.lx, a.ly], [b.lx, b.ly], [b.rx, b.ry], [a.rx, a.ry], sc.mud);
  }

  // 窄桥边缘高亮
  for (let i = 0; i < N; i += 1) {
    const s = track.samples[i];
    if (!s.bridge) continue;
    const j = (i + 1) % N;
    const a = edges[i];
    const b = edges[j];
    ctx.strokeStyle = sc.trackEdge;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(tx(a.lx), ty(a.ly));
    ctx.lineTo(tx(b.lx), ty(b.ly));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx(a.rx), ty(a.ry));
    ctx.lineTo(tx(b.rx), ty(b.ry));
    ctx.stroke();
  }

  // 赛道边缘描边
  ctx.strokeStyle = sc.trackEdge;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= N; i += 1) {
    const a = edges[i % N];
    const p = [a.lx, a.ly];
    if (i === 0) ctx.moveTo(tx(p[0]), ty(p[1]));
    else ctx.lineTo(tx(p[0]), ty(p[1]));
  }
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i <= N; i += 1) {
    const a = edges[i % N];
    const p = [a.rx, a.ry];
    if (i === 0) ctx.moveTo(tx(p[0]), ty(p[1]));
    else ctx.lineTo(tx(p[0]), ty(p[1]));
  }
  ctx.stroke();

  // 中线虚线
  ctx.strokeStyle = sc.trackCenter;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  for (let i = 0; i <= N; i += 1) {
    const s = track.samples[i % N];
    if (i === 0) ctx.moveTo(tx(s.x), ty(s.y));
    else ctx.lineTo(tx(s.x), ty(s.y));
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // 起点格子旗
  const start = track.sampleAt(0);
  const s0 = track.samples[0];
  const nx = -Math.sin(s0.angle);
  const ny = Math.cos(s0.angle);
  const halfW = s0.halfWidth;
  const cells = 6;
  for (let c = 0; c < cells; c += 1) {
    const t0 = c / cells;
    const t1 = (c + 1) / cells;
    const off0 = (t0 - 0.5) * 2 * halfW;
    const off1 = (t1 - 0.5) * 2 * halfW;
    const a = [start.x + nx * off0, start.y + ny * off0];
    const b = [start.x + nx * off1, start.y + ny * off1];
    const fwdX = Math.cos(s0.angle);
    const fwdY = Math.sin(s0.angle);
    const len = 16;
    const a2 = [a[0] + fwdX * len, a[1] + fwdY * len];
    const b2 = [b[0] + fwdX * len, b[1] + fwdY * len];
    ctx.fillStyle = c % 2 === 0 ? '#ffffff' : '#222222';
    ctx.beginPath();
    ctx.moveTo(tx(a[0]), ty(a[1]));
    ctx.lineTo(tx(a2[0]), ty(a2[1]));
    ctx.lineTo(tx(b2[0]), ty(b2[1]));
    ctx.lineTo(tx(b[0]), ty(b[1]));
    ctx.closePath();
    ctx.fill();
  }

  // 道具箱
  const count = Math.floor(track.length / ITEM.BOX_INTERVAL);
  for (let k = 0; k < count; k += 1) {
    const p = track.sampleAt((k + 0.5) * ITEM.BOX_INTERVAL);
    const nx2 = -Math.sin(p.angle);
    const ny2 = Math.cos(p.angle);
    const off = (k % 2 === 0 ? 1 : -1) * p.halfWidth * 0.45;
    const bx = p.x + nx2 * off;
    const by = p.y + ny2 * off;
    ctx.fillStyle = '#fff2a8';
    ctx.beginPath();
    ctx.arc(tx(bx), ty(by), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c95bff';
    ctx.fillRect(tx(bx) - 3, ty(by) - 1, 6, 2);
  }

  return canvas;
}

export function mapImageData(canvas) {
  const c = canvas.getContext('2d');
  return c.getImageData(0, 0, TEX, TEX);
}
