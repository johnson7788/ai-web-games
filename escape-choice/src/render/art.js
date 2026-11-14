// 素材路径常量表 + 一次性预载。对齐依据 assets/manifest.json 的 w/h/pivot；
// 加载失败置 null，渲染侧回退程序化绘制，绝不白屏 / undefined。
export const ART = {
  cell:     { src: 'assets/bg/cell.webp',     w: 1280, h: 722, pivot: 'top' },
  corridor: { src: 'assets/bg/corridor.webp', w: 1280, h: 722, pivot: 'top' },
  sewer:    { src: 'assets/bg/sewer.webp',    w: 1280, h: 722, pivot: 'top' },
  guard:    { src: 'assets/bg/guard.webp',    w: 1280, h: 722, pivot: 'top' },
  yard:     { src: 'assets/bg/yard.webp',     w: 1280, h: 722, pivot: 'top' },
  roof:     { src: 'assets/bg/roof.webp',     w: 1280, h: 722, pivot: 'top' },
  truck:    { src: 'assets/bg/truck.webp',    w: 1280, h: 722, pivot: 'top' },
  tunnel:   { src: 'assets/bg/tunnel.webp',   w: 1280, h: 722, pivot: 'top' },
  win:      { src: 'assets/bg/win.webp',      w: 1280, h: 722, pivot: 'top' },
  fail:     { src: 'assets/bg/fail.webp',     w: 1280, h: 722, pivot: 'top' },
  keyart:   { src: 'assets/keyart/escape-choice.webp', w: 1280, h: 722, pivot: 'top' },
};

export async function preload(onProgress) {
  const entries = Object.entries(ART);
  const textures = {};
  let done = 0;
  const total = entries.length;
  const report = () => { try { onProgress?.(done, total); } catch { /* 进度回调不阻塞 */ } };
  report();
  await Promise.all(entries.map(async ([key, item]) => {
    try {
      const img = new Image();
      img.src = item.src;
      await img.decode();
      textures[key] = img;
    } catch {
      textures[key] = null;
    } finally {
      done += 1;
      report();
    }
  }));
  return textures;
}
