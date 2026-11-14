// 美术素材：路径/尺寸/pivot 常量表 + 一次性预载（失败置 null，不抛错）。
// 落点与尺寸对齐 assets/manifest.json（来源 tools/artgen/plan.json 的 prep.out）。
export const ART = {
  bg:          { src: 'assets/bg/battlefield.webp',      w: 1280, h: 722, pivot: 'top',    color: '#160f1e', label: 'BATTLEFIELD' },
  towerArrow:  { src: 'assets/towers/arrow.webp',        w: 61,   h: 140, pivot: 'bottom', color: '#86efac', label: 'ARROW' },
  towerCannon: { src: 'assets/towers/cannon.webp',       w: 149,  h: 140, pivot: 'bottom', color: '#fbbf24', label: 'CANNON' },
  towerFrost:  { src: 'assets/towers/frost.webp',        w: 47,   h: 140, pivot: 'bottom', color: '#60a5fa', label: 'FROST' },
  enemyGrunt:  { src: 'assets/enemies/grunt.webp',       w: 112,  h: 120, pivot: 'bottom', color: '#fb7185', label: 'GRUNT' },
  enemyRunner: { src: 'assets/enemies/runner.webp',      w: 204,  h: 120, pivot: 'bottom', color: '#f472b6', label: 'RUNNER' },
  enemyBrute:  { src: 'assets/enemies/brute.webp',       w: 181,  h: 150, pivot: 'bottom', color: '#a78bfa', label: 'BRUTE' },
  gate:        { src: 'assets/props/fortress-gate.webp', w: 126,  h: 160, pivot: 'bottom', color: '#c084fc', label: 'GATE' },
  keyart:      { src: 'assets/keyart/cursed-keep.webp',  w: 1280, h: 722, pivot: 'top',    color: '#160f1e', label: 'KEYART' },
};

const imgs = new Map(); // src -> HTMLImageElement | null

/** 一次性预载全部素材，逐张报告进度 0..1；失败置 null 不抛错。 */
export async function preload(onProgress) {
  const srcs = [...new Set(Object.values(ART).map((a) => a.src))];
  let done = 0;
  await Promise.all(srcs.map((src) => (async () => {
    try {
      const img = new Image();
      img.src = src;
      if (img.decode) await img.decode();
      else await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      imgs.set(src, img);
    } catch { imgs.set(src, null); }
    done += 1;
    if (onProgress) onProgress(done / srcs.length);
  })()));
}

export function artMeta(key) { return ART[key] || null; }

export function getArt(key) {
  const meta = ART[key];
  return meta ? (imgs.get(meta.src) || null) : null;
}
