import { TAU, clamp, lerp, noise, inkPath, inkLine, inkArc, inkCircle, inkBlob, inkDrop, roughRect, roughPolygon } from './ink.js';

const TOPO = [
  [0, 1], [1, 2], [1, 3], [1, 4], [3, 5], [4, 6],
  [2, 7], [2, 8], [7, 9], [8, 10],
];

function readPoints(ent, alpha) {
  return (ent.body?.pts || []).map((p) => ({
    x: lerp(p.px ?? p.x, p.x, alpha),
    y: lerp(p.py ?? p.y, p.y, alpha),
    r: p.r,
  }));
}

function baseState(ent, palette, options) {
  const hp = clamp((ent.hp ?? 1) / (ent.maxHp || ent.hp || 1));
  const death = ent.dead ? clamp(1 - (ent.anim?.dead || 0) / 5.5) : 1;
  const invuln = ent.invuln > 0 ? 0.52 + Math.sin(options.t * 42) * 0.18 : 1;
  return {
    hp,
    alpha: death * invuln * (options.opacity ?? 1),
    color: ent.hitFlash > 0.72 ? '#ffffff' : palette.ink,
    gap: hp < 0.6 ? (0.6 - hp) * 0.62 : 0,
    reveal: ent.anim?.spawn > 0 ? clamp(1 - ent.anim.spawn / 0.5) : 1,
  };
}

function skeleton(ctx, pts, options) {
  for (let i = 0; i < TOPO.length; i += 1) {
    const [a, b] = TOPO[i];
    if (!pts[a] || !pts[b]) continue;
    inkLine(ctx, pts[a].x, pts[a].y, pts[b].x, pts[b].y, {
      color: options.color,
      width: options.width,
      alpha: options.alpha,
      seed: options.seed + i * 5.17,
      time: options.t,
      segments: 10 + (i % 3),
      jitter: options.jitter ?? 0.58,
      gap: options.gap,
      reveal: options.reveal,
      dry: options.dry ?? 0,
    });
  }
}

function drawGun(ctx, ent, palette, alpha, t, reveal) {
  if (!ent.gun) return;
  const { x, y } = ent.gun;
  const angle = Math.atan2(ent.gun.dy, ent.gun.dx);
  const color = palette.ink;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (ent.weapon === 'brush') {
    inkLine(ctx, -31, 0, -4, 0, { color, width: 7, alpha, seed: 402, time: t, segments: 10, reveal });
    const bristles = [
      [{ x: -4, y: -4 }, { x: 9, y: 0 }, { x: -4, y: 4 }],
      [{ x: -3, y: -2 }, { x: 12, y: 1 }, { x: -2, y: 2 }],
      [{ x: -3, y: 1 }, { x: 7, y: 5 }],
    ];
    bristles.forEach((path, i) => inkPath(ctx, path, {
      color: palette.accent, width: 2.4 - i * 0.4, alpha, seed: 410 + i,
      time: t, segments: 8, dry: 0.35, reveal,
    }));
  } else if (ent.weapon === 'nib') {
    roughPolygon(ctx, [{ x: -34, y: -2.7 }, { x: -5, y: -2 }, { x: 8, y: 0 }, { x: -5, y: 2 }, { x: -34, y: 2.7 }], {
      color, width: 1.9, alpha, seed: 420, time: t, jitter: 0.25, reveal,
    });
    inkLine(ctx, -12, 0, 9, 0, { color: palette.accent, width: 1.2, alpha, seed: 421, time: t, segments: 8, reveal });
    inkCircle(ctx, -7, 0, 1.3, { color, width: 1, alpha, seed: 422, time: t, segments: 8 });
  } else {
    roughPolygon(ctx, [
      { x: -34, y: -3.4 }, { x: -29, y: -5 }, { x: -4, y: -3.2 },
      { x: 8, y: 0 }, { x: -4, y: 3.2 }, { x: -29, y: 5 }, { x: -34, y: 3.4 },
    ], { color, width: 2.1, alpha, seed: 430, time: t, jitter: 0.28, reveal });
    inkLine(ctx, -28, 0, 1, 0, { color: palette.accent, width: 1.25, alpha: alpha * 0.8, seed: 431, time: t, segments: 10, reveal });
    roughPolygon(ctx, [{ x: 0, y: -2.4 }, { x: 9, y: 0 }, { x: 0, y: 2.4 }], {
      color, fill: color, fillAlpha: alpha * 0.7, width: 1, alpha, seed: 432, time: t, segments: 8,
    });
  }
  ctx.restore();
}

function drawRibbon(ctx, neck, ent, palette, state, options, ghost) {
  const speed = Math.abs(ent.vx || 0);
  const length = 40 + Math.min(70, speed * 0.17);
  const dir = speed > 20 ? -Math.sign(ent.vx) : -(ent.facing || 1);
  const points = [];
  for (let i = 0; i <= 14; i += 1) {
    const f = i / 14;
    points.push({
      x: neck.x + dir * length * f,
      y: neck.y + 2 + f * 12 + Math.sin(options.t * 5.2 - f * 7.5) * (2 + f * 8),
    });
  }
  inkPath(ctx, points, {
    color: ghost ? palette.inkSoft : palette.accent,
    width: ghost ? 3.2 : 4.4,
    alpha: state.alpha * (ghost ? 0.5 : 0.88),
    seed: 88, time: options.t, segments: 14, jitter: 0.7,
    dry: 0.5, gap: state.gap * 0.5, reveal: state.reveal,
  });
  if (!ghost) {
    inkPath(ctx, points.map((p) => ({ x: p.x, y: p.y + 2.2 })), {
      color: palette.ink, width: 1.1, alpha: state.alpha * 0.38,
      seed: 89, time: options.t, segments: 14, jitter: 0.65, dry: 0.75,
    });
  }
}

function drawPlayer(ctx, ent, pts, palette, options, ghost = false, shiftX = 0) {
  const state = baseState(ent, palette, options);
  if (ghost) state.alpha *= 0.16;
  if (shiftX) pts = pts.map((p) => ({ ...p, x: p.x + shiftX }));
  const seed = 100;
  drawRibbon(ctx, pts[1], ent, palette, state, options, ghost);
  skeleton(ctx, pts, {
    color: ghost ? palette.inkSoft : state.color,
    width: 4.15, alpha: state.alpha, seed, t: options.t,
    gap: state.gap, reveal: state.reveal, jitter: 0.62,
  });

  const chestY = lerp(pts[1].y, pts[2].y, 0.42);
  inkLine(ctx, pts[1].x - 5, chestY, pts[1].x + 6, chestY + 1, {
    color: state.color, width: 6.2, alpha: state.alpha * 0.86,
    seed: 121, time: options.t, segments: 8, gap: state.gap,
  });

  const head = pts[0];
  const r = Math.max(8, head.r || 9.5);
  inkArc(ctx, head.x, head.y, r, r * 1.04, -Math.PI / 3, Math.PI * 1.28, {
    color: state.color, width: 4.25, alpha: state.alpha,
    seed: 131, time: options.t, segments: 14, jitter: 0.58,
    gap: state.gap, reveal: state.reveal,
  });
  const dropX = head.x + Math.cos(-Math.PI / 3) * r;
  const dropY = head.y + Math.sin(-Math.PI / 3) * r + 3 + Math.sin(options.t * 3) * 1.5;
  inkDrop(ctx, dropX, dropY, 1.8, state.color, state.alpha, 132);

  if (!ghost) drawGun(ctx, ent, palette, state.alpha, options.t, state.reveal);

  if (state.hp < 0.3 && !ghost) {
    for (let i = 0; i < 5; i += 1) {
      const p = pts[1 + (i % 2)];
      const fall = (options.t * (8 + i * 2) + i * 9) % 25;
      inkDrop(ctx, p.x + (noise(i + 33) - 0.5) * 13, p.y + fall, 1.2 + noise(i) * 1.3,
        palette.ink, state.alpha * (1 - fall / 25), 150 + i);
    }
  }
}

function drawScribble(ctx, ent, pts, palette, options) {
  const state = baseState(ent, palette, options);
  const color = ent.hitFlash > 0.72 ? '#fff' : palette.inkSoft;
  skeleton(ctx, pts, { color, width: 2.05, alpha: state.alpha, seed: 201, t: options.t, gap: state.gap, reveal: state.reveal, jitter: 1.05 });
  const h = pts[0];
  for (let j = 0; j < 3; j += 1) {
    const r = 8 + j * 2.1;
    const path = [];
    for (let i = 0; i < 7; i += 1) {
      const a = i / 6 * TAU + j * 0.8;
      path.push({ x: h.x + Math.cos(a) * r * (0.55 + noise(j * 20 + i) * 0.65), y: h.y + Math.sin(a) * r * 0.75 });
    }
    inkPath(ctx, path, { color: j === 1 ? palette.accent2 : color, width: 1.8, alpha: state.alpha, seed: 211 + j, time: options.t, segments: 12, jitter: 1.1, reveal: state.reveal });
  }
  inkLine(ctx, pts[5].x - 5, pts[5].y - 3, pts[5].x + 5, pts[5].y + 3, { color, width: 1.8, alpha: state.alpha, seed: 220, time: options.t, segments: 8, jitter: 1 });
}

function drawNib(ctx, ent, pts, palette, options) {
  const state = baseState(ent, palette, options);
  const color = ent.hitFlash > 0.72 ? '#fff' : palette.ink;
  skeleton(ctx, pts, { color, width: 1.85, alpha: state.alpha, seed: 301, t: options.t, gap: state.gap, reveal: state.reveal, jitter: 0.42 });
  const h = pts[0];
  const dir = ent.facing || 1;
  inkPath(ctx, [
    { x: h.x - 9 * dir, y: h.y - 10 }, { x: h.x + 2 * dir, y: h.y - 2 },
    { x: h.x - 3 * dir, y: h.y + 1 },
  ], { color, width: 2.2, alpha: state.alpha, seed: 311, time: options.t, segments: 10, reveal: state.reveal });
  inkPath(ctx, [
    { x: h.x + 8 * dir, y: h.y - 9 }, { x: h.x + 3 * dir, y: h.y + 2 },
    { x: h.x + 10 * dir, y: h.y + 9 },
  ], { color, width: 2.2, alpha: state.alpha, seed: 312, time: options.t, segments: 10, reveal: state.reveal });
  inkLine(ctx, h.x - 2 * dir, h.y - 4, h.x + 4 * dir, h.y - 8, { color: palette.accent, width: 1.4, alpha: state.alpha, seed: 313, time: options.t, segments: 8 });
  const hand = pts[6];
  inkLine(ctx, hand.x - 4 * dir, hand.y - 12, hand.x + 5 * dir, hand.y + 12, { color, width: 3.1, alpha: state.alpha, seed: 320, time: options.t, segments: 10, dry: 0.3 });
}

function drawCompass(ctx, ent, pts, palette, options) {
  const state = baseState(ent, palette, options);
  const color = ent.hitFlash > 0.72 ? '#fff' : palette.ink;
  const longPts = pts.map((p) => ({ ...p }));
  for (const [k, f] of [[7, 9], [8, 10]]) {
    const knee = pts[k];
    const foot = pts[f];
    longPts[f].x = knee.x + (foot.x - knee.x) * 1.4;
    longPts[f].y = foot.y >= options.groundY - 3 ? foot.y : knee.y + (foot.y - knee.y) * 1.4;
  }
  skeleton(ctx, longPts, { color, width: 1.8, alpha: state.alpha, seed: 401, t: options.t, gap: state.gap, reveal: state.reveal, jitter: 0.36 });
  const h = pts[0];
  inkCircle(ctx, h.x, h.y - 5, 5, { color, width: 2, alpha: state.alpha, seed: 411, time: options.t, segments: 10 });
  inkLine(ctx, h.x - 2, h.y, h.x - 13, h.y + 22, { color, width: 1.9, alpha: state.alpha, seed: 412, time: options.t, segments: 10 });
  inkLine(ctx, h.x + 2, h.y, h.x + 10, h.y + 27, { color, width: 1.9, alpha: state.alpha, seed: 413, time: options.t, segments: 10 });
  inkLine(ctx, h.x, h.y - 10, h.x, h.y - 31, { color, width: 1.5, alpha: state.alpha, seed: 414, time: options.t, segments: 10 });
  if (ent.anim?.telegraph > 0) {
    const pulse = 0.55 + Math.sin(options.t * 24) * 0.35;
    inkCircle(ctx, h.x, h.y - 32, 4 + pulse * 3, { color: palette.accent, width: 2.2, alpha: state.alpha * pulse, seed: 415, time: options.t, segments: 10 });
    inkLine(ctx, h.x, h.y - 30, h.x, h.y - 62, { color: palette.accent, width: 1.4, alpha: state.alpha * pulse, seed: 416, time: options.t, segments: 10, dry: 0.4 });
  }
}

function drawSmudge(ctx, ent, pts, palette, options) {
  const state = baseState(ent, palette, options);
  const color = ent.hitFlash > 0.72 ? '#fff' : palette.ink;
  const r = ent.r || 40;
  const cx = pts[2].x;
  const cy = (pts[0].y + pts[2].y) * 0.5;
  for (let i = 0; i < 3; i += 1) {
    inkBlob(ctx, cx - (ent.facing || 1) * (r * 0.7 + i * 9), cy + r * 0.45 + i * 4,
      r * (0.32 - i * 0.05), r * 0.18, {
        color, fill: color, alpha: state.alpha * (0.35 - i * 0.07), fillAlpha: state.alpha * 0.2,
        width: 1.4, seed: 500 + i, time: options.t, dry: 0.5,
      });
  }
  inkBlob(ctx, cx, cy, r * 1.05, r * 0.94, {
    color, fill: color, alpha: state.alpha, fillAlpha: state.alpha * 0.88,
    width: 3.4, seed: 510, time: options.t, jitter: 1.2, dry: state.gap,
  });
  inkBlob(ctx, cx - r * 0.25, cy - r * 0.14, 3.2, 4.4, { color: palette.bg, fill: palette.bg, alpha: state.alpha, width: 1, seed: 511, time: options.t, jitter: 0.2 });
  inkBlob(ctx, cx + r * 0.25, cy - r * 0.14, 3.2, 4.4, { color: palette.bg, fill: palette.bg, alpha: state.alpha, width: 1, seed: 512, time: options.t, jitter: 0.2 });
  inkArc(ctx, cx, cy + r * 0.22, r * 0.18, r * 0.1, 0.15, Math.PI - 0.15, { color: palette.bg, width: 1.5, alpha: state.alpha * 0.7, seed: 513, time: options.t, segments: 8 });
}

function drawEraser(ctx, ent, pts, palette, options) {
  const state = baseState(ent, palette, options);
  const color = ent.hitFlash > 0.72 ? '#fff' : palette.ink;
  skeleton(ctx, pts, { color, width: 1.9, alpha: state.alpha, seed: 601, t: options.t, gap: state.gap, reveal: state.reveal, jitter: 0.45 });
  const h = pts[0];
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(-0.12 * (ent.facing || 1) + Math.sin(options.t * 2.4) * 0.035);
  roughRect(ctx, -17, -14, 34, 28, { color, fill: '#f5e8e5', fillAlpha: state.alpha * 0.96, width: 2.4, alpha: state.alpha, seed: 611, time: options.t, jitter: 0.45 });
  inkLine(ctx, -15, 5, 15, -5, { color: palette.accent, width: 2.1, alpha: state.alpha * 0.5, seed: 612, time: options.t, segments: 10, dry: 0.4 });
  ctx.restore();
  const hand = pts[5];
  roughRect(ctx, hand.x - 6, hand.y - 4, 12, 8, { color, fill: '#f5e8e5', fillAlpha: state.alpha, width: 1.5, alpha: state.alpha, seed: 613, time: options.t, segments: 8 });
  if (ent.anim?.telegraph > 0 || ent.anim?.melee > 0) {
    for (let i = 0; i < 3; i += 1) {
      inkLine(ctx, h.x - 42, h.y + 18 + i * 5, h.x + 38, h.y + 15 + i * 5, {
        color: '#ffffff', width: 4 - i * 0.6, alpha: state.alpha * (0.8 - i * 0.16),
        seed: 620 + i, time: options.t * 4, segments: 12, dry: 0.45,
      });
    }
  }
}

function drawBlank(ctx, ent, pts, palette, options) {
  const state = baseState(ent, palette, options);
  const hp = state.hp;
  const r = ent.r || 130;
  const cx = pts[0]?.x ?? ent.x;
  const cy = (pts[0]?.y ?? ent.y) - r * 0.25;
  const color = ent.hitFlash > 0.72 ? '#fff' : palette.ink;
  for (let i = 0; i < 3; i += 1) {
    inkArc(ctx, cx + i * 1.3, cy, r - i * 3, r * 1.08 - i * 2,
      -2.48 + (1 - hp) * 0.2, 2.5 + (1 - hp) * 0.45, {
        color, width: 10 - i * 2.4, alpha: state.alpha * (0.8 - i * 0.18),
        seed: 701 + i, time: options.t * 0.45, segments: 14, jitter: 1.1,
        dry: 0.72, gap: state.gap * 0.4,
      });
  }
  const eyeY = cy - r * 0.18;
  for (const side of [-1, 1]) {
    inkArc(ctx, cx + side * r * 0.35, eyeY, r * 0.14, r * (0.2 + (1 - hp) * 0.05), 0, TAU, {
      color, width: 7, alpha: state.alpha * 0.9, seed: 710 + side, time: options.t,
      segments: 14, dry: 0.6,
    });
    if (hp < 0.66) {
      inkLine(ctx, cx + side * r * 0.52, eyeY - r * 0.32, cx + side * r * 0.17, eyeY - r * (0.24 + (0.66 - hp) * 0.2), {
        color, width: 7, alpha: state.alpha * 0.8, seed: 720 + side, time: options.t,
        segments: 12, dry: 0.55,
      });
    }
  }
  if (ent.anim?.telegraph > 0) {
    inkCircle(ctx, cx, cy, r * 1.25 + Math.sin(options.t * 15) * 8, {
      color: palette.accent, width: 3, alpha: state.alpha * 0.55,
      seed: 730, time: options.t, segments: 14, dry: 0.6,
    });
  }
}

function drawDashGhosts(ctx, ent, pts, palette) {
  ctx.save();
  ctx.strokeStyle = palette.inkSoft;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 3; i >= 1; i -= 1) {
    const shift = -(ent.facing || 1) * i * 15;
    ctx.globalAlpha = 0.07 + (3 - i) * 0.035;
    ctx.lineWidth = 3.2 - i * 0.35;
    ctx.beginPath();
    for (const [a, b] of TOPO) {
      ctx.moveTo(pts[a].x + shift, pts[a].y);
      ctx.lineTo(pts[b].x + shift, pts[b].y);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pts[0].x + shift, pts[0].y, Math.max(8, pts[0].r || 9.5), -Math.PI / 3, Math.PI * 1.28);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pts[1].x + shift, pts[1].y);
    ctx.quadraticCurveTo(pts[1].x + shift - (ent.facing || 1) * 24, pts[1].y - 8, pts[1].x + shift - (ent.facing || 1) * 52, pts[1].y + 10);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawCharacter(ctx, ent, palette, options = {}) {
  const pts = readPoints(ent, options.alpha ?? 1);
  if (pts.length < 11) return;
  const opts = { t: 0, groundY: 636, alpha: 1, ...options };
  if (ent.anim?.dash > 0 && ent.kind === 'player') drawDashGhosts(ctx, ent, pts, palette);
  switch (ent.type) {
    case 'player': drawPlayer(ctx, ent, pts, palette, opts); break;
    case 'scribble': drawScribble(ctx, ent, pts, palette, opts); break;
    case 'nib': drawNib(ctx, ent, pts, palette, opts); break;
    case 'compass': drawCompass(ctx, ent, pts, palette, opts); break;
    case 'smudge': drawSmudge(ctx, ent, pts, palette, opts); break;
    case 'eraser': drawEraser(ctx, ent, pts, palette, opts); break;
    case 'blank': drawBlank(ctx, ent, pts, palette, opts); break;
    default: drawScribble(ctx, ent, pts, palette, opts); break;
  }
}
