export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export function noise(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function samplePath(points, count) {
  const lengths = [0];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    lengths.push(total);
  }
  const out = [];
  let edge = 1;
  for (let i = 0; i <= count; i += 1) {
    const d = total * i / count;
    while (edge < lengths.length - 1 && lengths[edge] < d) edge += 1;
    const a = points[edge - 1];
    const b = points[edge];
    const span = lengths[edge] - lengths[edge - 1] || 1;
    const t = (d - lengths[edge - 1]) / span;
    out.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
  }
  return out;
}

export function inkPath(ctx, source, options = {}) {
  if (!source || source.length < 2) return;
  const points = source.map((p) => Array.isArray(p) ? { x: p[0], y: p[1] } : p);
  const segments = Math.round(clamp(options.segments ?? 12, 8, 14));
  const sampled = samplePath(points, segments);
  const seed = options.seed ?? 1;
  const time = options.time ?? 0;
  const jitter = options.jitter ?? 0.55;
  const width = options.width ?? 2;
  const color = options.color ?? '#222';
  const alpha = options.alpha ?? 1;
  const reveal = clamp(options.reveal ?? 1);
  const gap = clamp(options.gap ?? 0, 0, 0.8);
  const dry = clamp(options.dry ?? 0);
  const wobble = options.wobble ?? 1;

  for (let i = 0; i < sampled.length; i += 1) {
    const prev = sampled[Math.max(0, i - 1)];
    const next = sampled[Math.min(sampled.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const phase = time * (1.25 + noise(seed) * 0.8) + seed * 1.91 + i * 2.37;
    const endSoft = i === 0 || i === sampled.length - 1 ? 0.45 : 1;
    const offset = Math.sin(phase) * jitter * endSoft * (0.45 + noise(seed + i * 4.1) * 0.55) * wobble;
    sampled[i] = {
      x: sampled[i].x - dy / len * offset,
      y: sampled[i].y + dx / len * offset,
    };
  }

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < segments; i += 1) {
    const t = i / segments;
    if (t > reveal) break;
    const missing = noise(seed * 3.7 + i * 8.13);
    if (i > 0 && i < segments - 1 && missing < gap) continue;
    if (noise(seed * 7.1 + i * 5.4) < dry * 0.24) continue;
    const dryAlpha = 1 - dry * noise(seed + i * 2.9) * 0.72;
    ctx.globalAlpha = alpha * dryAlpha * (0.82 + noise(seed + i * 1.37) * 0.18);
    ctx.lineWidth = Math.max(0.25, width * (1.15 - t * 0.45) * (0.91 + noise(seed + i * 9.7) * 0.18));
    ctx.beginPath();
    ctx.moveTo(sampled[i].x, sampled[i].y);
    ctx.lineTo(sampled[i + 1].x, sampled[i + 1].y);
    ctx.stroke();
  }
  ctx.restore();
}

export function inkLine(ctx, x1, y1, x2, y2, options = {}) {
  inkPath(ctx, [{ x: x1, y: y1 }, { x: x2, y: y2 }], options);
}

export function inkArc(ctx, x, y, rx, ry, start, end, options = {}) {
  const count = Math.round(clamp(options.segments ?? 14, 8, 14));
  const points = [];
  for (let i = 0; i <= count; i += 1) {
    const a = lerp(start, end, i / count);
    points.push({ x: x + Math.cos(a) * rx, y: y + Math.sin(a) * ry });
  }
  inkPath(ctx, points, { ...options, segments: count });
}

export function inkCircle(ctx, x, y, r, options = {}) {
  inkArc(ctx, x, y, r, options.ry ?? r, options.start ?? 0, options.end ?? TAU, options);
}

export function roughRect(ctx, x, y, w, h, options = {}) {
  const seed = options.seed ?? 1;
  inkPath(ctx, [
    { x, y }, { x: x + w, y }, { x: x + w, y: y + h },
    { x, y: y + h }, { x, y },
  ], { ...options, seed, segments: options.segments ?? 14 });
}

export function roughPolygon(ctx, points, options = {}) {
  if (!points.length) return;
  if (options.fill) {
    ctx.save();
    ctx.globalAlpha = options.fillAlpha ?? options.alpha ?? 1;
    ctx.fillStyle = options.fill;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  inkPath(ctx, [...points, points[0]], options);
}

export function inkBlob(ctx, x, y, rx, ry, options = {}) {
  const seed = options.seed ?? 1;
  const count = 14;
  const points = [];
  for (let i = 0; i < count; i += 1) {
    const a = i / count * TAU;
    const r = 0.84 + noise(seed + i * 3.17) * 0.28;
    points.push({ x: x + Math.cos(a) * rx * r, y: y + Math.sin(a) * ry * r });
  }
  roughPolygon(ctx, points, {
    color: options.color ?? '#222', width: options.width ?? 1.5,
    alpha: options.alpha ?? 1, seed, time: options.time ?? 0,
    jitter: options.jitter ?? 0.7, dry: options.dry ?? 0,
    fill: options.fill, fillAlpha: options.fillAlpha,
  });
}

export function inkDrop(ctx, x, y, r, color, alpha = 1, seed = 1) {
  inkBlob(ctx, x, y, r, r * 1.25, {
    color, fill: color, alpha, fillAlpha: alpha * 0.86,
    width: Math.max(0.5, r * 0.35), jitter: 0.18, seed,
  });
}

export function hatch(ctx, x, y, w, h, spacing, options = {}) {
  const count = Math.ceil((w + h) / spacing);
  for (let i = 0; i < count; i += 1) {
    const d = i * spacing;
    const x1 = x + Math.max(0, d - h);
    const y1 = y + Math.min(h, d);
    const x2 = x + Math.min(w, d);
    const y2 = y + Math.max(0, d - w);
    inkLine(ctx, x1, y1, x2, y2, {
      ...options, seed: (options.seed ?? 1) + i * 1.91,
      segments: 8, jitter: options.jitter ?? 0.25,
    });
  }
}

function rgb(hex) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function createPaper(map, w = 1280, h = 720) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const base = rgb(map.palette.bg);
  const small = document.createElement('canvas');
  small.width = 320;
  small.height = 180;
  const sctx = small.getContext('2d');
  const image = sctx.createImageData(small.width, small.height);
  const dark = map.id === 'neon' || map.id === 'blueprint';
  for (let i = 0; i < image.data.length; i += 4) {
    const n = (noise(i * 0.071 + map.act * 17) - 0.5) * (dark ? 8 : 12);
    image.data[i] = clamp(base[0] + n, 0, 255);
    image.data[i + 1] = clamp(base[1] + n, 0, 255);
    image.data[i + 2] = clamp(base[2] + n, 0, 255);
    image.data[i + 3] = 255;
  }
  sctx.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(small, 0, 0, w, h);

  const fiberColor = dark ? map.palette.inkSoft : map.palette.ink;
  const fibers = map.id === 'blank' ? 54 : 110;
  for (let i = 0; i < fibers; i += 1) {
    const x = noise(i * 4.3 + map.act) * w;
    const y = noise(i * 7.7 + map.act * 3) * h;
    const len = 24 + noise(i * 2.9) * 150;
    const horizontal = map.id === 'draft' || noise(i * 9.1) > 0.25;
    inkLine(ctx, x, y, x + (horizontal ? len : len * 0.12), y + (horizontal ? 2 : len * 0.4), {
      color: fiberColor, width: 0.45, alpha: map.id === 'blank' ? 0.025 : 0.045,
      seed: i + map.act * 100, segments: 8, jitter: 0.25,
    });
  }
  return canvas;
}
