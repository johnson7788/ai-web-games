// src/render/erase.js — 程序化「笔画擦除」：把成语渲染成墨迹，随机抠掉一部分笔画像素。
// 纯浏览器端（用 canvas 2D + getImageData），确定性（传入 seed 可复现）。
import { mulberry32 } from '../game/rng.js';

const FONT_STACK = '"PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", "SimHei", "STHeiti", sans-serif';

/**
 * 生成一个「被擦去部分笔画」的成语 canvas。
 * @param {string} idiom 四字成语
 * @param {object} opts { width, height, fontPx, ink, eraseRatio, seed }
 * @returns {HTMLCanvasElement}
 */
export function renderErasedIdiom(idiom, opts = {}) {
  const {
    width = 560,
    height = 200,
    fontPx = 128,
    ink = '#2a2016',
    eraseRatio = 0.3,
    seed = 0,
  } = opts;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, width, height);

  const chars = Array.from(idiom);
  const step = width / Math.max(1, chars.length);
  ctx.font = `700 ${fontPx}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = ink;
  for (let i = 0; i < chars.length; i += 1) {
    ctx.fillText(chars[i], step * i + step / 2, height / 2);
  }

  eraseInk(canvas, eraseRatio, seed);
  return canvas;
}

/** 收集墨迹像素，随机成块擦除（模拟「删减笔画」）。 */
function eraseInk(canvas, ratio, seed) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width, height } = canvas;
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  const idxAt = (x, y) => (y * width + x) * 4;
  const isInk = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    return d[idxAt(x, y) + 3] > 128;
  };

  // 采样墨迹像素（每 2px 采样即可，足够分布）
  const ink = [];
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (isInk(x, y)) ink.push([x, y]);
    }
  }
  if (!ink.length) return;

  const rng = mulberry32(seed >>> 0);
  const target = Math.max(1, Math.floor(ink.length * ratio));
  let erased = 0;
  let guard = 0;
  const maxGuard = ink.length * 4;

  while (erased < target && guard++ < maxGuard) {
    const [cx, cy] = ink[Math.floor(rng() * ink.length)];
    if (!isInk(cx, cy)) continue;
    const r = 2 + Math.floor(rng() * 3); // 半径 2..4，成块更像缺笔
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (isInk(x, y)) {
          d[idxAt(x, y) + 3] = 0;
          erased += 1;
          if (erased >= target) { ctx.putImageData(img, 0, 0); return; }
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}
