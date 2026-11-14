// 素材路径常量表 + 一次性预载（Image.decode）。失败置 null，渲染层回退程序化占位。
// w/h/pivot 取自 assets/manifest.json；sprite 绘制按这些值对齐（bottom 脚底 / center 中心）。
export const ART = {
  bg:       { src: 'assets/bg/classroom.webp',              w: 1280, h: 722, pivot: 'top' },
  flagpole: { src: 'assets/sprites/flagpole.webp',          w: 60,   h: 420, pivot: 'bottom' },
  frame:    { src: 'assets/sprites/frame-classroom.webp',   w: 602,  h: 380, pivot: 'center' },
};

const imgs = { bg: null, flagpole: null, frame: null };

export function getArt() {
  return imgs;
}

export function preload(onProgress) {
  const keys = Object.keys(ART);
  let done = 0;
  const tick = () => { done += 1; if (onProgress) onProgress(done, keys.length); };
  return Promise.all(keys.map((key) => {
    const meta = ART[key];
    const img = new Image();
    img.src = meta.src;
    return img.decode()
      .then(() => { imgs[key] = img; })
      .catch(() => { imgs[key] = null; })
      .finally(tick);
  }));
}
