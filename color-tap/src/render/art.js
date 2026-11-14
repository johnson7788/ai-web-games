// src/render/art.js — AI 素材路径常量 + 一次性预载（Image.decode，失败置 null）。
// 素材来自 tools/artgen/plan.json 各项 prep.out；对齐用 assets/manifest.json 的 w/h/pivot。

const ASSETS = {
  bg: 'assets/bg/atelier.webp',            // 游戏主背景（深夜画室）
  frame: 'assets/sprites/frame-ornate.webp', // 画框装饰（抠图 sprite）
  celebration: 'assets/bg/celebration.webp', // 完成庆祝背景
  keyart: 'assets/keyart/color-tap.webp',    // 标题封面
};

// 已解码图像；未加载/失败为 null（渲染端据此回退程序化占位）。
export const art = {
  bg: null,
  frame: null,
  celebration: null,
  keyart: null,
  ready: false,
};

// 画框 sprite：manifest 尺寸/pivot + 抠图实测镂空开口（用于把开口等比贴到格上）。
export const FRAME = {
  w: 451,
  h: 560,
  pivot: 'center',
  openW: 321, // 抠图实测镂空开口宽
  openH: 429, // 抠图实测镂空开口高
};

function loadOne(key, url) {
  return new Promise((resolve) => {
    const img = new Image();
    const done = (ok) => { art[key] = ok ? img : null; resolve(); };
    img.onload = () => {
      if (img.decode) img.decode().then(() => done(true)).catch(() => done(false));
      else done(true);
    };
    img.onerror = () => done(false);
    img.src = url;
  });
}

export function preload(onProgress) {
  const entries = Object.entries(ASSETS);
  let loaded = 0;
  return Promise.all(
    entries.map(([key, url]) =>
      loadOne(key, url).then(() => {
        loaded += 1;
        if (onProgress) onProgress(loaded / entries.length);
      }),
    ),
  ).then(() => { art.ready = true; });
}

export default art;
