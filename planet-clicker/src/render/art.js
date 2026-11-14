// AI 素材接线：路径常量表 + 一次性预载（Image.decode()，失败置 null）。
// 只承载「美术件」；玩法层（几何/判定/粒子/浮字）仍在 render/index.js 程序化。

export const ART = {
  bg: 'assets/bg/deep-space.webp',
  planets: {
    earth: 'assets/planets/earth.webp',
    mars: 'assets/planets/mars.webp',
    jupiter: 'assets/planets/jupiter.webp',
    saturn: 'assets/planets/saturn.webp',
    neptune: 'assets/planets/neptune.webp',
    sun: 'assets/planets/sun.webp',
  },
};

// manifest 里的 w/h/pivot（像素宽高、对齐方式）；drawImage 按此对齐，不写死落点。
const META = {
  'assets/bg/deep-space.webp': { w: 1280, h: 722, pivot: 'top' },
  'assets/planets/earth.webp': { w: 361, h: 360, pivot: 'center' },
  'assets/planets/mars.webp': { w: 361, h: 360, pivot: 'center' },
  'assets/planets/jupiter.webp': { w: 362, h: 360, pivot: 'center' },
  'assets/planets/saturn.webp': { w: 361, h: 360, pivot: 'center' },
  'assets/planets/neptune.webp': { w: 360, h: 360, pivot: 'center' },
  'assets/planets/sun.webp': { w: 338, h: 360, pivot: 'center' },
};

const images = new Map(); // path -> HTMLImageElement | null
let loadProgress = 0;     // 0..1

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** 一次性预载；每项失败置 null（不抛错、不白屏）。onProgress 收到 0..1。 */
export function preload(onProgress) {
  const paths = [ART.bg, ...Object.values(ART.planets)];
  loadProgress = 0;
  const jobs = paths.map(async (src) => {
    let img = null;
    try {
      const raw = await loadImage(src);
      if (raw) {
        await raw.decode();
        img = raw;
      }
    } catch {
      img = null;
    }
    images.set(src, img);
    loadProgress += 1 / paths.length;
    if (onProgress) onProgress(loadProgress);
  });
  return Promise.all(jobs);
}

/** 已加载的图像（缺失为 null），供渲染层取用。 */
export function image(path) {
  return images.get(path) || null;
}

export function progress() {
  return loadProgress;
}

/** 按 manifest w/h/pivot 画 sprite；返回是否真的画了（false 时调用方画占位）。 */
export function drawSprite(ctx, path, cx, cy, width, rotate = 0) {
  const img = images.get(path);
  if (!img) return false;
  const m = META[path];
  const w = width;
  const h = m ? width * (m.h / m.w) : width;
  let x = cx - w / 2;
  let y = cy - h / 2;
  if (m && m.pivot === 'bottom') y = cy - h;
  else if (m && m.pivot === 'top') y = cy;
  ctx.save();
  if (rotate) {
    ctx.translate(cx, cy);
    ctx.rotate(rotate);
    ctx.translate(-cx, -cy);
  }
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
  return true;
}
