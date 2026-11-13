// src/core/viewport.js — 逻辑舞台 ↔ 真实视口 的适配层
//
// 为什么是「固定设计分辨率 + 缩放」而不是纯流式布局：
//   ① 碰撞/摆位/生成范围全在 1280×720 里算，难度与设备无关（手机和 4K 屏手感一致）；
//   ② 逐帧 PNG 的像素尺寸是绝对值，一个统一 scale 就能整幅等比，不会出现 sprite 比例失调；
//   ③ 校验只需验一个坐标系，不必为每档屏幕各验一次。
// 但「固定」只发生在逻辑层，映射层必须自适应，这就是本文件的三件事：
//   fit        bleed（默认：背景出血铺满，玩法层整幅不裁）| contain（整幅可见，留白交给背景光晕）| cover（铺满裁边，HUD 必须落在安全区）
//   pixelRatio 画布后备分辨率按真实像素比算（带上限），4K/2.75 倍屏不再发虚
//   vis/safe   背景该画到多大的逻辑矩形；cover 时保证可见的安全区
//
// 用法：
//   const vp = createViewport(GAME.design);
//   vp.onChange((s) => game.resize(s));   // 视口变化（含旋转、地址栏伸缩）

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const MODES = ["bleed", "contain", "cover"];

export function createViewport(design, opts = {}) {
  const W = design.width;
  const H = design.height;
  const mode = MODES.includes(opts.fit) ? opts.fit : "bleed";
  const maxPixelRatio = clamp(Number(opts.maxPixelRatio) || 3, 1, 4);
  const safeInset = clamp(Number(opts.safe) ?? 0.05, 0, 0.25);

  const state = {
    mode,
    width: W,
    height: H,
    vw: W,
    vh: H,
    scale: 1,          // 逻辑像素 → CSS 像素（玩法层）
    bleedScale: 1,     // 逻辑像素 → CSS 像素（背景铺满用）
    pixelRatio: 1,     // CSS 像素 → canvas 后备像素
    ox: 0,             // 玩法层在视口中的左上角偏移（CSS px）
    oy: 0,
    // 背景需要覆盖的逻辑矩形（bleed 时超出 0..W / 0..H，即出血区）
    vis: { x0: 0, y0: 0, x1: W, y1: H },
    cropX: 0,          // cover 时左右各被裁掉的逻辑像素
    cropY: 0,
    isPortrait: false,
    safe: { left: 0, right: W, top: 0, bottom: H }
  };

  const subs = new Set();

  function apply() {
    const root = document.documentElement.style;
    root.setProperty("--stage-scale", String(state.scale));
    root.setProperty("--stage-ox", `${state.ox}px`);
    root.setProperty("--stage-oy", `${state.oy}px`);
    root.setProperty("--safe-l", `${state.safe.left}px`);
    root.setProperty("--safe-r", `${W - state.safe.right}px`);
    root.setProperty("--safe-t", `${state.safe.top}px`);
    root.setProperty("--safe-b", `${H - state.safe.bottom}px`);
    document.body.dataset.fit = state.mode;
    document.body.dataset.orientation = state.isPortrait ? "portrait" : "landscape";
  }

  function measure() {
    const vw = Math.max(1, window.innerWidth);
    const vh = Math.max(1, window.innerHeight);
    const kx = vw / W;
    const ky = vh / H;
    const scale = mode === "cover" ? Math.max(kx, ky) : Math.min(kx, ky);

    state.vw = vw;
    state.vh = vh;
    state.scale = scale;
    state.bleedScale = Math.max(kx, ky);
    // 后备分辨率跟「真实显示像素」走：写死 2 倍会在 4K / 2.75 倍屏上被放大而发虚
    state.pixelRatio = clamp(window.devicePixelRatio || 1, 1, maxPixelRatio);
    state.isPortrait = vh > vw;

    // 玩法层居中
    state.ox = Math.round((vw - W * scale) / 2);
    state.oy = Math.round((vh - H * scale) / 2);

    // 背景出血矩形：把整个视口反算回逻辑坐标（bleed 才有意义）
    state.vis = mode === "bleed"
      ? {
        x0: -state.ox / scale,
        y0: -state.oy / scale,
        x1: (vw - state.ox) / scale,
        y1: (vh - state.oy) / scale
      }
      : { x0: 0, y0: 0, x1: W, y1: H };

    // cover 时超出视口的部分（每边），安全区必须把它们让出来
    state.cropX = Math.max(0, (W * scale - vw) / 2) / scale;
    state.cropY = Math.max(0, (H * scale - vh) / 2) / scale;

    // 只有 cover 会裁内容；bleed/contain 下整幅都可见，安全区就是设计稿本身。
    // cover 用「裁剪量 + 设计留边」而不是取较大值：否则安全区正好贴着屏幕边缘，HUD 会贴边。
    const insetX = mode === "cover" ? state.cropX + safeInset * W : 0;
    const insetY = mode === "cover" ? state.cropY + safeInset * H : 0;
    state.safe = { left: insetX, right: W - insetX, top: insetY, bottom: H - insetY };

    apply();
    return state;
  }

  function onChange(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  }

  function notify(s) {
    subs.forEach((fn) => fn(s));
  }

  let lastKey = "";
  const refresh = () => {
    const s = measure();
    const key = `${s.vw}x${s.vh}@${s.pixelRatio.toFixed(2)}`;
    // 只在真正变化时回调：移动端地址栏抖动不重建 canvas
    if (key === lastKey) return;
    lastKey = key;
    notify(s);
  };

  if (typeof window !== "undefined") {
    window.addEventListener("resize", refresh, { passive: true });
    window.addEventListener("orientationchange", () => setTimeout(refresh, 120));
    if (window.visualViewport) window.visualViewport.addEventListener("resize", refresh, { passive: true });
  }

  measure();
  lastKey = `${state.vw}x${state.vh}@${state.pixelRatio.toFixed(2)}`;

  return {
    state,
    measure,
    refresh,
    onChange,
    /** 背景绘制矩形（bleed 时超出设计边界） */
    get vis() { return state.vis; },
    get safe() { return state.safe; },
    get scale() { return state.scale; },
    get pixelRatio() { return state.pixelRatio; },
    get offset() { return { x: state.ox, y: state.oy }; },
    get mode() { return state.mode; },
    get isPortrait() { return state.isPortrait; }
  };
}
