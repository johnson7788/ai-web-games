/**
 * 图片资源装载。全部本地静态文件，零网络依赖。
 * 加载失败不会白屏：缺图时渲染层会退化成程序化绘制。
 */
const FILES = {
  bg_wind: 'assets/img/bg_wind.jpg',
  bg_fire: 'assets/img/bg_fire.jpg',
  bg_thunder: 'assets/img/bg_thunder.jpg',
  log: 'assets/img/log.webp',
  log_body: 'assets/img/log_body.webp',
  trunk: 'assets/img/trunk.webp',
  rune: 'assets/img/rune.jpg',
  panel: 'assets/img/panel.webp',
  red_idle: 'assets/img/hero_red_idle.webp',
  red_raise: 'assets/img/hero_red_raise.webp',
  red_strike: 'assets/img/hero_red_strike.webp',
  red_dead: 'assets/img/hero_red_dead.webp',
  blue_idle: 'assets/img/hero_blue_idle.webp',
  blue_raise: 'assets/img/hero_blue_raise.webp',
  blue_strike: 'assets/img/hero_blue_strike.webp',
  blue_dead: 'assets/img/hero_blue_dead.webp',
};

export const IMG = {};
export const LOAD_FAILED = new Set();

function loadOne(key, src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { IMG[key] = img; resolve(true); };
    img.onerror = () => { LOAD_FAILED.add(key); resolve(false); };
    img.src = src;
  });
}

export async function loadAll(onProgress) {
  const entries = Object.entries(FILES);
  let done = 0;
  await Promise.all(entries.map(([key, src]) =>
    loadOne(key, src).then((ok) => { done += 1; onProgress?.(done / entries.length); return ok; })
  ));
  // trunk.png 是「有更好」的资源，缺了会退回拼接树皮，不算失败
  return [...LOAD_FAILED].every((k) => k === 'trunk');
}

export function has(key) { return !!IMG[key]; }
export function optionalFailures() { return [...LOAD_FAILED]; }
