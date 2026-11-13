// config/game.config.js — NIGHTFALL: OUTBREAK 全局配置（数值 / 文案键 / 资产表的唯一来源）
export const GAME = {
  id: "nightfall-outbreak",
  name: "NIGHTFALL: OUTBREAK",
  nameZh: "夜幕爆发",
  slug: "nightfall-outbreak",
  version: "1.0.0",

  // 1280×720 是逻辑坐标系；真实视口由 src/core/viewport.js 等比映射（横屏 H5 触屏不重叠）
  design: {
    width: 1280,
    height: 720,
    fit: "bleed",
    safe: 0.05,
    maxPixelRatio: 3
  },

  // 美术决策（Step 2 两问分别落盘）：
  //   framing = three 真 3D 场景（three.js r160 + 本地 GLB + AnimationMixer）
  //   style   = 3d-cartoon（真 3D 路线唯一合法 low-poly 造型枚举）
  // 观感由「电影级程序化光照 / 体积雾 / AgX / bloom / 暗角 / 颗粒」拉到 3A 档次，见 src/art/render.js
  art: {
    framing: "three",
    style: "3d-cartoon",
    styleLock: "polyfork halloween-night kit + same low-poly material family, no mixed kits",
    // 开屏整屏海报（横版 16:9，与 og:image 同一张）；由 main.js 注入 #boot-bg，CSS 不写死 url()
    poster: "poster.jpg"
  },

  theme: { world: "wasteland", hue: 186 },

  // 逐帧清单：本作是真 3D 路线，characters/fx 为空（角色全部来自 GLB 骨骼动画）
  frames: {
    dir: "assets/images/frames/",
    manifest: "assets/images/frame-manifest.json",
    canvas: 512,
    baseline: 20,
    ext: "webp"
  },

  images: {
    dir: "assets/images/",
    backgrounds: ["bg_loading.webp"]
  },

  // 本地 GLB 模型（polyfork，仅库内资产，不引用任何 CDN/.mjs）
  models: {
    dir: "assets/models/",
    characters: ["teen-zombie-b5bb27", "villager-40255c", "ashigaru-foot-soldier-806707"],
    props: [
      "twisted-dead-oak-49457b", "dead-tree-6795fa", "carved-headstone-09d9f8",
      "grave-mound-169ec3", "wrought-iron-cemetery-fence-f1a113", "cemetery-lantern-post-fed352",
      "jack-o-lantern-0b1ddb", "campfire-4390aa", "cargo-crate-9afc44",
      "haunted-victorian-house-886931", "street-lamp-29f365", "arched-cemetery-gate-bdca7c"
    ]
  },

  // 纯 WebAudio 实时合成的离线镜像（同时是 AudioContext 不可用时的降级）；运行时优先实时合成
  audio: {
    dir: "assets/audio/",
    master: 0.8,
    bgm: "bgm_main.wav",
    files: {
      click: "sfx_click.wav",
      rifle: "sfx_rifle.wav",
      reload: "sfx_reload.wav",
      dry: "sfx_dry.wav",
      impact: "sfx_impact.wav",
      headshot: "sfx_headshot.wav",
      zombie: "sfx_zombie.wav",
      zombieDie: "sfx_zombie_die.wav",
      hurt: "sfx_hurt.wav",
      step: "sfx_step.wav",
      wave: "sfx_wave.wav",
      boss: "sfx_boss.wav",
      explode: "sfx_explode.wav",
      win: "sfx_win.wav",
      lose: "sfx_lose.wav"
    }
  },

  ads: {
    revive: "revive",
    doubleCoins: "doubleCoins",
    assist: "assist",
    stageClear: "stageClear",
    assists: { perRun: 3, refill: 3, maxRefillPerRun: 2 },
    interstitial: { skipFirstLevels: 3 }
  },

  // 金币出口：武器涂装（buySkin 是唯一扣费点）
  shop: {
    skins: [
      { id: "classic", cost: 0,   tint: null,      nameKey: "skin.classic" },
      { id: "ember",   cost: 200, tint: "#ff7a3c", nameKey: "skin.ember" },
      { id: "toxic",   cost: 500, tint: "#9fe870", nameKey: "skin.toxic" }
    ]
  },

  // 玩法数值基线（P0 保真：30 发弹匣、100 血、hitscan 判定窗口）
  play: {
    moveSpeed: 620,
    startingLives: 3,
    health: 100,
    magazine: 30,
    fireRateMs: 120,
    reloadMs: 1500,
    adsFov: 52,
    hipFov: 76,
    judgeWindowMs: 90,
    crosshairTolerance: 78,
    assistHeal: 35
  }
};
