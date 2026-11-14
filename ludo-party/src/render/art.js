// 素材路径常量表 + 一次性预载（Image.decode，失败置 null）。
// 尺寸/pivot 取自 assets/manifest.json；玩法层（格/编号/高亮/判定几何）不在此。
export const ART = {
  bgTable:        { src: 'assets/bg/table.webp',           w: 1280, h: 723, pivot: 'top' },
  boardParchment: { src: 'assets/bg/board-parchment.webp', w: 1024, h: 579, pivot: 'top' },
  keyart:         { src: 'assets/keyart/ludo-party.webp',  w: 1280, h: 723, pivot: 'top' },
  redPlane:       { src: 'assets/tokens/red-plane.webp',   w: 104,  h: 90,  pivot: 'center' },
  bluePlane:      { src: 'assets/tokens/blue-plane.webp',  w: 95,   h: 90,  pivot: 'center' },
  die:            { src: 'assets/tokens/die.webp',         w: 122,  h: 120, pivot: 'center' },
};

const images = {};

export function art(key) { return images[key] || null; }
export function artMeta(key) { return ART[key]; }

/** 一次性预载全部素材；单张失败仅置 null，不影响其余。 */
export function preload(onProgress) {
  const keys = Object.keys(ART);
  let done = 0;
  const bump = () => {
    done += 1;
    if (onProgress) onProgress(done / keys.length);
  };
  return Promise.all(keys.map((key) => {
    const img = new Image();
    img.src = ART[key].src;
    return img.decode()
      .then(() => { images[key] = img; })
      .catch(() => { images[key] = null; })
      .finally(bump);
  }));
}
