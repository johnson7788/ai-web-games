// 素材接线：路径常量表 + 一次性预载（Image.decode），失败置 null。
// 尺寸/pivot 取自 assets/manifest.json；渲染按 w/h 等比缩放、pivot 对齐。
// 任何一项加载失败 → get() 返回 null → 渲染方回退程序化占位，不白屏。

const ASSETS = {
  'card-back':   { src: 'assets/cards/back.webp',    w: 173, h: 248, pivot: 'center' },
  'card-red':    { src: 'assets/cards/red.webp',     w: 161, h: 248, pivot: 'center' },
  'card-yellow': { src: 'assets/cards/yellow.webp',  w: 162, h: 248, pivot: 'center' },
  'card-green':  { src: 'assets/cards/green.webp',   w: 156, h: 248, pivot: 'center' },
  'card-blue':   { src: 'assets/cards/blue.webp',    w: 167, h: 248, pivot: 'center' },
  'card-wild':   { src: 'assets/cards/wild.webp',    w: 162, h: 248, pivot: 'center' },
  'bg-table':    { src: 'assets/bg/table.webp',      w: 1280, h: 722, pivot: 'top' },
  'avatar-1':    { src: 'assets/avatars/ai-1.webp',  w: 129, h: 160, pivot: 'center' },
  'avatar-2':    { src: 'assets/avatars/ai-2.webp',  w: 153, h: 160, pivot: 'center' },
};

const imgs = {};
let progress = 0;

function loadOne(key, spec) {
  return new Promise((resolve) => {
    const img = new Image();
    const done = (ok) => { imgs[key] = ok ? img : null; resolve(); };
    img.onload = () => {
      if (img.decode) img.decode().then(() => done(true)).catch(() => done(false));
      else done(true);
    };
    img.onerror = () => done(false);
    img.src = spec.src;
  });
}

// 一次性预载全部素材；无论成败都 resolve（失败项置 null）。
export async function preload(onProgress) {
  const keys = Object.keys(ASSETS);
  let n = 0;
  await Promise.all(keys.map((k) => loadOne(k, ASSETS[k]).then(() => {
    n += 1;
    progress = n / keys.length;
    if (onProgress) onProgress(progress);
  })));
}

export function get(key) { return imgs[key] || null; }
export function spec(key) { return ASSETS[key] || null; }
export function getProgress() { return progress; }

export const art = { ASSETS, preload, get, spec, getProgress };
export default art;
