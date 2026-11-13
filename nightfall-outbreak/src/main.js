// src/main.js — 平台入口：开屏真实进度 / 域名锁 / 广告 SDK / 视口 / 输入 / 主循环
// 顺序按技能规范：线上 SDK 外链在 index.html 里排在 module 入口之前；这里只做接线。
import { GAME } from "config/game.config.js";
import { t } from "core/i18n.js";
import { createViewport } from "core/viewport.js";
import { enforceDomainLock } from "core/domainlock.js";
import { Ads } from "core/ads.js";
import { Assist } from "core/assist.js";
import { GameAudio } from "core/audio.js";
import { preloadArt } from "core/assets.js";
import { Renderer3D } from "art/render.js";
import { Game } from "game/main.js";
import { Input, isTouchDevice } from "game/input.js";
import { UI } from "ui/ui.js";

/**
 * 开屏整屏海报：只认 art.poster 的显式声明，不猜文件、不在 CSS 写死 url()。
 * 留空 → 零请求露出渐变底；填了 → 图片解码成功才淡入，绝不刷 404 把冒烟打红。
 */
function attachPoster() {
  const bg = document.getElementById("boot-bg");
  const src = GAME.art && GAME.art.poster;
  if (!bg || !src) return;
  const img = new Image();
  img.onload = () => {
    bg.style.backgroundImage = `url("${src}")`;
    bg.classList.add("is-ready");
  };
  img.onerror = () => console.warn("[boot] poster unavailable, falling back to gradient");
  img.src = src;
}

async function boot() {
  attachPoster();                 // 装饰层，不 await：不阻塞开屏进度与真实预载
  const ui = new UI();
  ui.setBoot(0);

  // 域名锁：仅 localhost / pipygames.com 放行，其余 3 秒后跳站（提示不阻断加载）
  enforceDomainLock(() => ui.toast(t("toast.redirect")));

  const vp = createViewport(GAME.design);
  const audio = new GameAudio().build();
  const ads = new Ads(GAME.ads);
  await ads.init();          // SDK 未到位立即返回 false：广告位隐藏，游戏照常可玩

  const canvas = document.getElementById("view");
  // 开屏数字只认「真实加载完成数」：首屏 GLB + 音频镜像 + 背景 + 帧清单
  const pre = await preloadArt(GAME, null, (r) => ui.setBoot(r * 0.9));
  ui.setBoot(0.96);

  const renderer = new Renderer3D({
    canvas, viewport: vp, pool: pre.pool, headless: pre.headless
  });
  vp.onChange(() => renderer.resize());
  // 场景道具在后台补载，不阻塞开局；失败只丢道具，天空/地面/光照/雾仍然完整
  renderer.buildProps().catch((err) => console.warn("[props] skipped", err && err.message));

  const assist = new Assist(GAME.ads.assists);
  const touch = isTouchDevice();
  document.body.dataset.touch = touch ? "1" : "0";
  const input = new Input(document.getElementById("game-root"), {
    onPause: () => {
      if (game.state === "playing") game.pause();
      else if (game.state === "paused") game.resume();
    },
    onFirstAction: () => audio.unlock(),
    onStore: () => game.openStore(),
    onInventory: () => game.openInventory(),
    onAssist: () => game.assistAction()
  });
  input.bindPad(document.getElementById("pad-left"), "left");
  input.bindPad(document.getElementById("pad-right"), "right");
  input.bindAction(document.getElementById("pad-fire"), "fire");
  input.bindAction(document.getElementById("pad-aim"), "aim");
  input.bindAction(document.getElementById("pad-reload"), "reload");
  input.bindAction(document.getElementById("pad-jump"), "jump");

  const game = new Game({
    renderer, pool: pre.pool, audio, ui, ads, assist, input,
    headless: pre.headless, touch
  });

  ui.bind({
    play: () => game.play(),
    sectors: () => game.openSectors(),
    closeSectors: () => game.closeSectors(),
    sound: () => { audio.unlock(); ui.setSound(audio.toggleMute()); },
    store: () => game.openStore(),
    inventory: () => game.openInventory(),
    pause: () => game.pause(),
    resume: () => game.resume(),
    home: () => game.toMenu(),
    closeStore: () => game.closePanel(),
    closeInv: () => game.closePanel(),
    revive: () => game.revive(),
    doubleCoins: () => game.doubleCoins(),
    retry: () => game.startRun(game.levelIndex, game.mode, { fresh: true }),
    assist: () => game.assistAction(),
    mode: (name) => game.setMode(name)
  });

  // WebAudio 自动播放策略：首次交互才建 AudioContext；
  // 每次交互都确认 BGM 调度器存活（切后台/静音后能自己复活，而不是静默到底）。
  const unlock = () => { audio.unlock(); audio.ensureMusic(); };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);

  ui.finishBoot();

  let last = performance.now();
  const frame = (now) => {
    // 后台恢复时 dt 夹紧：不瞬移、不把连击/换弹一次结算完。
    // 保持 0.05s：调大上限会让每帧转向步长随之变大，方向键在窄瞄准带里过冲，
    // 真人/冒烟都收敛不到准星。低帧率下动作变慢由步态叠加 + 更近的生成距离补偿。
    const rawDt = Math.max(0, (now - last) / 1000);
    const dt = Math.min(0.05, rawDt);
    // 骨骼动画单独吃真实时间（上限 0.2s 防后台回来一次跳完整个 clip）。
    // 位移/转向/计时仍用夹紧 dt，保证低帧率下不会瞬移、方向键也不会过冲。
    const animDt = Math.min(0.2, rawDt);
    last = now;
    try { game.update(dt, animDt); }
    catch (err) { console.error("[loop]", err && err.message); }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot().catch((err) => {
  console.error("[boot] failed", err);
  const pct = document.getElementById("boot-pct");
  const tip = document.getElementById("boot-tip");
  if (pct) pct.textContent = "0";
  if (tip) tip.textContent = "Startup failed — reload the page";
});
