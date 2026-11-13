// src/core/assets.js — 开屏真实进度：首屏关键 GLB + 音频镜像 + 背景，其余模型空闲分批预热。
// 参考项目经验：不要一次性把几百个文件全并发 new Image()，会撞满连接池；这里只 await 首屏。
import { createModelPool } from "../../lib/polyfork.js";
import { MODELS } from "../../assets/models/manifest.js";

export function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve({ url, img, ok: true });
    img.onerror = () => resolve({ url, img: null, ok: false });
    img.src = url;
  });
}

/** 首屏必须到位的模型：一只僵尸 + 4 件场景道具；其余交给 preheat */
export const FIRST_SCREEN_MODELS = [
  "teen-zombie-b5bb27",
  "twisted-dead-oak-49457b", "dead-tree-6795fa",
  "campfire-4390aa", "carved-headstone-09d9f8"
];

/**
 * @returns {{pool, images: Map, missing: string[], audioNames: string[]}}
 * onProgress(ratio 0..1) 由「真实加载完成数 / 总数」驱动，不是假动画。
 */
export async function preloadArt(GAME, manifest, onProgress = () => {}, opts = {}) {
  const modelIds = FIRST_SCREEN_MODELS.slice();
  const audioNames = [...Object.values(GAME.audio.files), GAME.audio.bgm];
  const backgrounds = GAME.images.backgrounds || [];
  const total = modelIds.length + audioNames.length + Math.max(1, backgrounds.length) + 2;
  let modelDone = 0;
  let otherDone = 0;
  const emit = () => onProgress(Math.min(1, (modelDone + otherDone) / Math.max(1, total)));
  const missing = [];

  const headless = opts.headless === true ||
    (typeof navigator !== "undefined" && (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent || "")));

  const pool = createModelPool({
    manifest: MODELS,
    base: GAME.models.dir,
    concurrency: 4,
    shadows: !headless,
    onProgress: ({ loaded }) => { modelDone = Math.min(modelIds.length, loaded); emit(); }
  });
  pool.track(modelIds);

  // 音频与背景并行；WAV 只是离线镜像，运行时走 WebAudio 实时合成，这里只确认文件可读
  const jobs = [];
  for (const name of audioNames) {
    jobs.push(fetch(GAME.audio.dir + name, { cache: "force-cache" })
      .then((r) => { if (!r.ok) missing.push(name); })
      .catch(() => missing.push(name))
      .finally(() => { otherDone += 1; emit(); }));
  }
  for (const bg of backgrounds) {
    jobs.push(loadImage(GAME.images.dir + bg).then((r) => {
      if (!r.ok) missing.push(bg);
      otherDone += 1;
      emit();
      return r;
    }));
  }
  // 帧清单（真 3D 路线为空，但仍是交付契约的一部分）
  jobs.push(fetch(GAME.frames.manifest, { cache: "no-store" })
    .then((r) => r.json()).catch(() => ({}))
    .finally(() => { otherDone += 1; emit(); }));

  // 关键路径：只 await 首屏模型 + 上面这批小文件
  const loadedModels = pool.preload(modelIds).catch(() => []);
  const results = await Promise.all([loadedModels, ...jobs]);
  const bgResults = results.slice(1, 1 + backgrounds.length);
  const images = new Map();
  bgResults.forEach((r) => { if (r && r.ok) images.set(r.url, r.img); });

  otherDone += 1;                          // 渲染器初始化这一步
  emit();
  // 非关键资源：空闲时低并发补载，不阻塞开局
  const rest = MODELS.map((m) => m.id).filter((id) => !modelIds.includes(id));
  pool.preheat(rest);
  onProgress(1);
  return { pool, images, missing, audioNames, headless };
}
