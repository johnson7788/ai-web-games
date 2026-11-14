// 素材路径常量表 + 一次性预载（Image.decode，失败置 null）。
// 只负责画布美术件（背景 / 矿石 sprite）；图标走 DOM <img>，keyart 走 CSS。
// 玩法层（矿井几何 / 深度标尺 / 浮字 / 粒子 / 判定）保持程序化，不在这里。
export const ART = {
  bg: { src: 'assets/bg/mine-shaft.webp', w: 1280, h: 722, pivot: 'top' },
  ores: {
    dirt:    { src: 'assets/ores/dirt.webp',    w: 156, h: 120, pivot: 'center' },
    coal:    { src: 'assets/ores/coal.webp',    w: 167, h: 120, pivot: 'center' },
    iron:    { src: 'assets/ores/iron.webp',    w: 171, h: 120, pivot: 'center' },
    gold:    { src: 'assets/ores/gold.webp',    w: 123, h: 120, pivot: 'center' },
    diamond: { src: 'assets/ores/diamond.webp', w: 109, h: 120, pivot: 'center' },
  },
};

const images = Object.create(null);
let ready = false;

function entries() {
  const out = [ART.bg];
  for (const key of Object.keys(ART.ores)) out.push(ART.ores[key]);
  return out;
}

export function preload(onProgress = () => {}) {
  const list = entries();
  let done = 0;
  const report = () => {
    art.progress = done / list.length;
    onProgress(art.progress);
  };
  return Promise.all(
    list.map((entry) => new Promise((resolve) => {
      const img = new Image();
      const ok = () => { images[entry.src] = img; resolve(); };
      const fail = () => { images[entry.src] = null; resolve(); };
      img.onload = () => { if (img.decode) img.decode().then(ok, fail); else ok(); };
      img.onerror = fail;
      img.src = entry.src;
    }).then(() => { done += 1; report(); }))
  ).then(() => { ready = true; report(); });
}

export const art = {
  progress: 0,
  get ready() { return ready; },
  img(entry) { return entry ? (images[entry.src] || null) : null; },
};
