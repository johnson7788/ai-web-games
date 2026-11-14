// src/render/art.js — 素材路径常量表（唯一来源，数据取自 assets/manifest.json）+ 一次性预载 + 对齐绘制。
// 预载失败置 null；调用方回退程序化占位，绝不白屏 / undefined。
import { WORLD } from '../../config/game.config.js';

export const ART = {
  bg: {
    attic:      { src: 'assets/bg/attic.webp',      w: 1280, h: 723, pivot: 'top' },
    study:      { src: 'assets/bg/study.webp',      w: 1280, h: 723, pivot: 'top' },
    greenhouse: { src: 'assets/bg/greenhouse.webp', w: 1280, h: 723, pivot: 'top' },
  },
  keyart: { src: 'assets/keyart/hidden-quest.webp', w: 1280, h: 723, pivot: 'top' },
  items: {
    key:      { src: 'assets/items/key.webp',      w: 63,  h: 80, pivot: 'center' },
    star:     { src: 'assets/items/star.webp',     w: 80,  h: 80, pivot: 'center' },
    heart:    { src: 'assets/items/heart.webp',    w: 89,  h: 80, pivot: 'center' },
    gem:      { src: 'assets/items/gem.webp',      w: 99,  h: 80, pivot: 'center' },
    coin:     { src: 'assets/items/coin.webp',     w: 70,  h: 80, pivot: 'center' },
    apple:    { src: 'assets/items/apple.webp',    w: 71,  h: 80, pivot: 'center' },
    fish:     { src: 'assets/items/fish.webp',     w: 102, h: 80, pivot: 'center' },
    moon:     { src: 'assets/items/moon.webp',     w: 75,  h: 80, pivot: 'center' },
    bell:     { src: 'assets/items/bell.webp',     w: 64,  h: 80, pivot: 'center' },
    crown:    { src: 'assets/items/crown.webp',    w: 126, h: 80, pivot: 'center' },
    leaf:     { src: 'assets/items/leaf.webp',     w: 55,  h: 80, pivot: 'center' },
    mushroom: { src: 'assets/items/mushroom.webp', w: 71,  h: 80, pivot: 'center' },
  },
};

const store = { bg: {}, items: {}, keyart: null };

function put(kind, key, img) {
  if (kind === 'keyart') store.keyart = img;
  else store[kind][key] = img;
}

export function getImage(kind, key) {
  if (kind === 'keyart') return store.keyart;
  return store[kind]?.[key] ?? null;
}

export function preload(onProgress) {
  const entries = [];
  for (const [key, a] of Object.entries(ART.bg)) entries.push({ kind: 'bg', key, ...a });
  entries.push({ kind: 'keyart', key: null, ...ART.keyart });
  for (const [key, a] of Object.entries(ART.items)) entries.push({ kind: 'items', key, ...a });
  const total = entries.length;
  let done = 0;
  const tasks = entries.map((e) => new Promise((resolve) => {
    const img = new Image();
    const ok = () => { put(e.kind, e.key, img); resolve(); };
    const bad = () => { put(e.kind, e.key, null); resolve(); };
    try {
      if (img.decode) {
        img.src = e.src;
        img.decode().then(ok, bad);
      } else {
        img.onload = ok;
        img.onerror = bad;
        img.src = e.src;
      }
    } catch {
      bad();
    }
  }).then(() => {
    done += 1;
    if (onProgress) onProgress(done, total);
  }));
  return Promise.all(tasks);
}

// 按 pivot 对齐绘制 sprite（bottom 脚底 / center 中心 / top 顶边），scale 控制缩放。
export function drawSprite(ctx, img, x, y, meta, scale) {
  const w = meta.w * scale;
  const h = meta.h * scale;
  let dx;
  let dy;
  if (meta.pivot === 'center') { dx = x - w / 2; dy = y - h / 2; }
  else if (meta.pivot === 'bottom') { dx = x - w / 2; dy = y - h; }
  else { dx = x; dy = y; } // 'top'
  ctx.drawImage(img, dx, dy, w, h);
}

// 整幅 cover 铺底（保持宽高比填满 1280×720，pivot 决定裁哪边）。
export function drawCover(ctx, img, meta) {
  const scale = Math.max(WORLD.WIDTH / meta.w, WORLD.HEIGHT / meta.h);
  const w = meta.w * scale;
  const h = meta.h * scale;
  const dx = (WORLD.WIDTH - w) / 2;
  const dy = meta.pivot === 'top' ? 0 : (WORLD.HEIGHT - h) / 2;
  ctx.drawImage(img, dx, dy, w, h);
}
