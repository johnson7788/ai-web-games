// 素材路径常量表 + 一次性预载（Image.decode），失败置 null。
// 路径相对文档根（img.src 解析基准），asset-check 据此校验文件存在。
// 尺寸不写死：加载完成后由 naturalWidth/naturalHeight 提供，渲染层按逻辑尺寸等比缩放。
import { ARENAS, KARTS, CONFIG } from '../../config/game.config.js';

export const PATHS = {
  arenas: Object.fromEntries(ARENAS.map((a) => [a.id, a.bg])),
  karts: Object.fromEntries(Object.entries(KARTS).map(([id, k]) => [id, k.body])),
  sprites: {
    mushroom: 'assets/sprites/mushroom.webp',
    gumdrop: 'assets/sprites/gumdrop.webp',
    crate: 'assets/sprites/pickup-crate.webp',
  },
  keyart: CONFIG.keyart,
  bgm: 'assets/audio/bgm.mp3',
};

const ALL = [
  ...Object.values(PATHS.arenas),
  ...Object.values(PATHS.karts),
  ...Object.values(PATHS.sprites),
  PATHS.keyart,
];
const images = new Map();

function loadOne(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(); return; }
    const img = new Image();
    img.onload = () => {
      img.decode()
        .then(() => { images.set(src, img); resolve(); })
        .catch(() => { images.set(src, img); resolve(); });
    };
    img.onerror = () => { images.set(src, null); resolve(); };
    img.src = src;
  });
}

export function preload(onProgress) {
  let done = 0;
  return Promise.all(ALL.map((src) => loadOne(src).then(() => {
    done += 1;
    if (onProgress) onProgress(done, ALL.length);
  })));
}

export const art = {
  PATHS,
  get(src) { return images.get(src) || null; },
  ready(src) { return !!images.get(src); },
  /** 贴图尺寸（缺图返回 null），供渲染层做等比缩放。 */
  size(src) {
    const img = images.get(src);
    if (!img) return null;
    return { w: img.naturalWidth || img.width, h: img.naturalHeight || img.height };
  },
  /** 渲染层用的统一访问器（createRenderer(canvas, assets)）。 */
  image(src) { return images.get(src) || null; },
};
