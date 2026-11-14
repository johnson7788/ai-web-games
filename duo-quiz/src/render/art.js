// 素材接线：路径常量表 + 一次性预载（Image.decode，失败置 null）。
// 尺寸/pivot 取自 assets/manifest.json；背景/keyart 整幅铺底，mascot 按 pivot=center。
// 任何一项加载失败 → get() 返回 null → 渲染端回退程序化占位，不白屏、不 undefined。
const ASSETS = {
  'bg-arena':         { src: 'assets/bg/arena.webp',            w: 1280, h: 723, pivot: 'top' },
  'keyart-duo-quiz':  { src: 'assets/keyart/duo-quiz.webp',     w: 1280, h: 723, pivot: 'top' },
  'mascots/blue-neutral': { src: 'assets/mascots/blue-neutral.webp', w: 226, h: 240, pivot: 'center' },
  'mascots/blue-correct': { src: 'assets/mascots/blue-correct.webp', w: 268, h: 240, pivot: 'center' },
  'mascots/blue-wrong':   { src: 'assets/mascots/blue-wrong.webp',   w: 245, h: 240, pivot: 'center' },
  'mascots/blue-win':     { src: 'assets/mascots/blue-win.webp',     w: 243, h: 240, pivot: 'center' },
  'mascots/red-neutral':  { src: 'assets/mascots/red-neutral.webp',  w: 249, h: 240, pivot: 'center' },
  'mascots/red-correct':  { src: 'assets/mascots/red-correct.webp',  w: 255, h: 240, pivot: 'center' },
  'mascots/red-wrong':    { src: 'assets/mascots/red-wrong.webp',    w: 239, h: 240, pivot: 'center' },
  'mascots/red-win':      { src: 'assets/mascots/red-win.webp',      w: 240, h: 240, pivot: 'center' },
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

export function mascotKey(player, expr) {
  return `mascots/${player === 0 ? 'blue' : 'red'}-${expr}`;
}
export function mascotSrc(player, expr) {
  const s = ASSETS[mascotKey(player, expr)];
  return s ? s.src : '';
}

export const art = { ASSETS, preload, get, spec, getProgress, mascotKey, mascotSrc };
export default art;
