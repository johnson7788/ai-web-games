/* 自动生成：请勿手改。源码在 src/gamesdk.js + host.config.js，用 tools/build_hosted.py 重新生成。 */
;(function (root) {
"use strict";

/* ============================================================
 * 云端中心配置（pipysdk.js 托管版专用）
 * ------------------------------------------------------------------
 * 流程：改这里 → python sdk/tools/build_hosted.py → 上传 dist/pipysdk.js
 *      到游戏站 public/sdk/ 下，所有接了托管 SDK 的游戏立即生效。
 *
 * 只有「想不重发 SDK 就改广告开关/频次/埋点地址」时才需要动 host.hot.json
 * （上传成 public/sdk/config.json 即可，2 分钟内生效）。
 *
 * 注意：
 *   - games.<appId> 只允许覆盖 appId / appName / ads / tracking，
 *     不要在这里覆盖 domain / protect / save，否则 integrityToken 校验会失败。
 *   - 改了 domain.allowedHosts / protect / save.guard 后必须重新跑
 *     node tools/gen_token.js 并把新 token 填到 protect.integrityToken。
 * ============================================================ */
root.PIPYSDK_HOST_CONFIG = {
  version: "1.0.0",

  // 运行时热更新配置地址（空 = 关闭热更新）。只允许改 ads / tracking。
  runtimeConfigUrl: "https://pipygames.com/sdk/config.json",

  // 服务端 App 配置下发（状态门槛 + 全局吊销）：SDK 启动时拉取，
  // 返回 adsEnabled:false（未过审/已下架/ID 不存在）则关闭广告。
  // 网络失败 fail-open（沿用内嵌配置，域名白名单仍兜底）。
  appConfigUrl: "https://pipygames.com/api/sdk/config",

  // 默认游戏标识（页面标签 data-app-id 优先于这里）
  appId: "pipysdk-global",
  appName: "PipyGames",

  // 域名授权（防搬运）。所有可能挂游戏的域名都要加进来。
  domain: {
    enabled: true,
    allowedHosts: [
      "localhost", "127.0.0.1", "::1",
      "pipygames.com", "www.pipygames.com"
    ],
    redirectUrl: "https://pipygames.com",
    redirectDelayMs: 3000,
    allowFileProtocol: true, // 本地双击可跑；上线正式站后建议改 false
    allowIframe: true,       // 游戏在站点详情页 iframe 内运行，必须 true
    debug: false
  },

  // 广告。provider 说明：
  //   pipybridge  —— 游戏跑在 pipygames.com 站点 iframe 内时，自动走内嵌的
  //                  PipyAd 平台广告桥（PIPY_AD_REQUEST 协议，站方父页面负责填充）。
  //                  桥代码已整合进 pipysdk.js，游戏页只需引这一个脚本。
  //                  不在 iframe 内（本地直开）自动降级 mock。
  //   mock / none —— 模拟 / 关闭
  //   （注意：不接 Poki / CrazyGames 等第三方平台）
  ads: {
    // 托管版默认开启：真正的填充/扣量由站方父页面决定，SDK 只负责把请求发出去。
    // 要全局一键关广告 → 改 host.hot.json 上传 config.json（当前线上即为关闭）。
    enabled: true,
    provider: "pipybridge", // 历史别名 "y8bridge" 仍可识别
    testMode: true,
    debug: false,

    // 平台广告桥（PipyAd）。代码已内嵌，无需再引任何独立桥脚本、不发额外请求。
    bridge: {
      // 消息协议：
      //   auto   —— 先发 PIPY_AD_REQUEST，1.5s 无应答再补发历史协议（默认值，
      //             纯 PIPY 命名且兼容尚未升级的旧父页面，零中断）
      //   pipy   —— 只发 PIPY_AD_REQUEST / 收 PIPY_AD_DONE（父页面已升级后推荐）
      //   legacy —— 只发历史协议，仅用于回滚
      // 该字段可通过热更新 config.json 切换，无需重发 SDK。
      protocol: "auto",
      // 只接受来自这些父页面 origin 的回包。iframe 内收到父页消息时 e.origin 是父页真实 origin，
      // 白名单能有效挡住「恶意站点 iframe 嵌游戏后伪造发奖」。生产务必配置，留空 = 不校验。
      allowedOrigins: ["https://pipygames.com", "https://www.pipygames.com"],
      requestTimeoutMs: 30000, // 单次广告请求超时
      noParentFallback: true,  // 本地直开无父页面时降级返回成功，仅供调试
      noParentDelayMs: 3000
    },
    global: {
      pauseGameDuringAd: true,
      muteAudioDuringAd: true,
      fillTimeoutMs: 9000,
      simulateMs: 1200
    },
    // placements 是开放字典：加一个 key 就等于新开一个广告位，没有代码白名单。
    // 站方父页面按 msg.placement 分位填充与结算，未知 placement 一律不填充（安全默认）。
    placements: {
      revive:      { format: "rewarded",     id: "", enabled: true,  maxPerRun: 1, cooldownMs: 0,     sdk: "" },
      doubleCoins: { format: "rewarded",     id: "", enabled: true,  maxPerRun: 1, cooldownMs: 0,     sdk: "" },
      // 助攻/提示补充：次数由游戏侧状态机（perRun / maxRefillPerRun）管理，
      // 所以这里 maxPerRun 必须是 null（不设上限），否则会和游戏侧数字打架——
      // SDK 层先拦住时游戏侧还以为能补，表现为「点了没反应且无报错」。
      // cooldownMs 只防连点误触，不要设大，免得正常节奏的第二次补充被静默拦掉。
      assist:      { format: "rewarded",     id: "", enabled: true,  maxPerRun: null, cooldownMs: 1000, sdk: "" },
      // 提示/跳过小游戏/临时道具等其它扩展位，按需在此追加，无需改 SDK 代码
      stageClear:  { format: "interstitial", id: "", enabled: true,  everyNLevels: 3, cooldownMs: 45000, sdk: "" },
      gameOver:    { format: "interstitial", id: "", enabled: false, everyNPlays: 2,  cooldownMs: 60000, sdk: "" }
    },
    providerConfig: {
      custom: { scriptUrl: "", adapterGlobal: "PipyAdBridge" }
    },
    mockText: "广告播放中…"
  },

  // 防破解（运行时保护）。integrityToken 用 node tools/gen_token.js 生成。
  protect: {
    enabled: true,
    devtoolsAction: "warn", // off | warn | pause | blur | redirect
    devtoolsTrap: true,
    disableContextMenu: true,
    disableDevtoolsShortcuts: true,
    integrity: true,
    integrityToken: 3427580868, // node tools/gen_token.js 生成（2026-10-30）
    heartbeatMs: 0,
    reportUrl: ""
  },

  // 事件监控（埋点）
  tracking: {
    enabled: true,
    bufferSize: 200,
    endpoint: "", // 上报地址（空 = 仅本地缓存）
    debug: false,
    autoEnv: true,
    storageKey: "sdk_events"
  },

  // 存档防作弊
  save: {
    enabled: true,
    key: "save",
    guard: { coins: 1e9, best: 1e9, count: 1e8 }
  },

  // 单游戏覆盖（data-app-id 命中后合并）。只放 appId/appName/ads/tracking。
  games: {
    // "g_1792921794802": { appId: "g_1792921794802", appName: "示例游戏A" },
    // "demo": { appId: "demo", appName: "Demo Game" }
  }
};
/**
 * 公共游戏 SDK（单文件源码 · ES Module）
 * ------------------------------------------------------------------
 * 能力：防破解（域名授权 / 反调试 / 配置完整性 / 存档防作弊）
 *      + 事件监控（加载 / 开始 / 通关 / 失败 / 复活 / 广告 / 自定义）
 *      + 广告调用（rewarded / interstitial，多平台适配）
 *
 * 设计原则：
 *   - 离线单机可跑，不依赖任何 CDN / 外部脚本；
 *   - 单文件，可被 build_dist.py 直接转成经典 <script> 全局版本；
 *   - 接口稳定：ads 模块复刻原游戏 Ads 类的全部方法，旧游戏几乎零改动接入。
 *
 * 构建：node 不需要。请运行 `python sdk/tools/build_dist.py` 生成 sdk/gamesdk.js。
 */

/* ============================ 版本 / 盐 ============================ */
const SDK_VERSION = "1.0.0";
// 配置完整性校验盐。修改它会使已有的 integrityToken 失效（需重新生成）。
const SDK_SALT = "g7Kp2xQ9vLm3Wn8TzR4bYc6";

/* ============================ 小工具 ============================ */
function isObj(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}
// 合并时禁止写入这些键，阻断 __proto__ / constructor / prototype 注入式原型污染。
const DANGEROUS_KEYS = ["__proto__", "constructor", "prototype"];
function safeKey(k) {
  return !DANGEROUS_KEYS.includes(k);
}
function mergeDeep(...sources) {
  // 用 null 原型对象，避免合并结果继承到已被污染的 Object.prototype
  const out = Object.create(null);
  for (const s of sources) {
    if (!isObj(s)) continue;
    // Object.keys 只取自有键，即使 Object.prototype 已被污染也不会遍历污染键
    for (const k of Object.keys(s)) {
      if (!safeKey(k)) continue;
      const val = s[k];
      if (isObj(val) && isObj(out[k])) out[k] = mergeDeep(out[k], val);
      else out[k] = val;
    }
  }
  return out;
}
/** 稳定字符串哈希（djb2），用于配置/存档校验 */
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h;
}
function checksum(obj) {
  try {
    return djb2(JSON.stringify(obj) + SDK_SALT);
  } catch (e) {
    return 0;
  }
}
function safeGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}
function safeSet(key, val) {
  try {
    window.localStorage.setItem(key, val);
    return true;
  } catch (e) {
    return false;
  }
}

/* ============================ 默认配置 ============================ */
const DEFAULT_CONFIG = {
  // 游戏标识（埋点区分用）
  appId: "unknown-game",
  appName: "Unknown Game",
  version: SDK_VERSION,

  // 域名授权（防搬运 / 站点独占）
  domain: {
    enabled: true,
    allowedHosts: ["localhost", "127.0.0.1", "::1"],
    redirectUrl: "https://pipygames.com",
    redirectDelayMs: 3000,
    allowFileProtocol: true,
    allowIframe: true,
    debug: true
  },

  // 广告（接口与旧 Ads 类一致）
  ads: {
    enabled: false,
    provider: "mock", // none | mock | pipybridge | custom（pipybridge 由托管引导注入）
    testMode: true,
    global: {
      pauseGameDuringAd: true,
      muteAudioDuringAd: true,
      fillTimeoutMs: 9000,
      simulateMs: 1200
    },
    placements: {
      revive: { format: "rewarded", id: "", enabled: true, maxPerRun: 1, cooldownMs: 0, sdk: "" },
      doubleCoins: { format: "rewarded", id: "", enabled: true, maxPerRun: 1, cooldownMs: 0, sdk: "" },
      // 助攻/提示补充：使用次数由游戏侧状态机管理，SDK 侧不设 maxPerRun（null = 不限），
      // 只留 1s 冷却防连点误触。若在这里加上限，游戏侧以为还能补却补不动，且无报错。
      assist: { format: "rewarded", id: "", enabled: true, maxPerRun: null, cooldownMs: 1000, sdk: "" },
      stageClear: { format: "interstitial", id: "", enabled: true, everyNLevels: 3, cooldownMs: 45000, sdk: "" },
      gameOver: { format: "interstitial", id: "", enabled: false, everyNPlays: 2, cooldownMs: 60000, sdk: "" }
    },
    providerConfig: {
      custom: { scriptUrl: "", adapterGlobal: "GameAdAdapter" }
    },
    // mock 模式占位遮罩文案（游戏也可 bindOverlay 用自己的 UI）
    mockText: "广告播放中…"
  },

  // 防破解（运行时保护）
  protect: {
    enabled: true,
    // 反调试动作：off | warn(仅上报) | pause(暂停游戏) | blur(失焦) | redirect(跳授权页)
    devtoolsAction: "warn",
    // 用 debugger 陷阱检测 devtools 打开（打开时会明显卡顿，形成威慑）
    devtoolsTrap: true,
    // 生产环境屏蔽右键菜单
    disableContextMenu: true,
    // 屏蔽 F12 / Ctrl+Shift+I / Ctrl+U / Ctrl+S
    disableDevtoolsShortcuts: true,
    // 配置完整性校验（防止有人把 protect.enabled 改成 false 绕过）
    integrity: true,
    // integrityToken：由 tools/gen_token.js 生成；为空则不做强制校验
    integrityToken: "",
    // 篡改心跳上报间隔（毫秒），0 = 不心跳
    heartbeatMs: 0,
    // 篡改/埋点上报地址（空则只本地）
    reportUrl: ""
  },

  // 事件监控（埋点）
  tracking: {
    enabled: true,
    bufferSize: 200,
    endpoint: "", // 上报地址（空 = 仅本地 console + localStorage）
    debug: true,
    autoEnv: true, // 自动附带 UA / 语言 / 分辨率 / 来源
    storageKey: "sdk_events" // 本地事件缓冲落盘键
  },

  // 存档防作弊（可选，由游戏调用 SDK.shield）
  save: {
    enabled: true,
    key: "save",
    // 关键数值合理上限，超出视为作弊
    guard: { coins: 1e9, best: 1e9, count: 1e8 }
  }
};

/* ============================ 域名授权 ============================ */
class DomainLock {
  constructor(config) {
    this.config = config || {};
    this.result = null;
  }
  static normalize(host) {
    return String(host || "").toLowerCase().replace(/\.$/, "");
  }
  static matchHost(host, pattern) {
    const h = DomainLock.normalize(host);
    let p = DomainLock.normalize(pattern);
    if (!h || !p) return false;
    if (p.startsWith("*.")) p = p.slice(2);
    return h === p || h.endsWith("." + p);
  }
  inspect() {
    const proto = location.protocol;
    const host = location.hostname;
    if (proto === "file:" && !this.config.allowFileProtocol) {
      this.result = { allowed: false, host, protocol: proto, reason: "file-protocol" };
      return this.result;
    }
    let allowed;
    if (proto === "file:" && this.config.allowFileProtocol) {
      allowed = true;
    } else {
      allowed = (this.config.allowedHosts || []).some((p) => DomainLock.matchHost(host, p));
    }
    this.result = { allowed, host, protocol: proto, reason: allowed ? "ok" : "host-not-allowed" };
    if (this.config.debug) {
      const tag = allowed ? "✔ 授权域名" : "✘ 未授权域名";
      console.log("[SDK·Domain]", tag, "host=" + (host || "(file)"), "protocol=" + proto);
    }
    return this.result;
  }
  enforce(cb) {
    const r = this.result || this.inspect();
    if (r.allowed) return false;
    const delay = Math.max(0, this.config.redirectDelayMs || 0);
    if (cb && typeof cb.onLock === "function") cb.onLock(delay);
    const started = Date.now();
    const timer = setInterval(() => {
      const left = Math.max(0, delay - (Date.now() - started));
      if (cb && typeof cb.onTick === "function") cb.onTick(left);
      if (left <= 0) {
        clearInterval(timer);
        this.redirect();
      }
    }, 200);
    setTimeout(() => this.redirect(), delay + 400); // 兜底：setInterval 被节流也保证跳转
    return true;
  }
  redirect() {
    const url = this.config.redirectUrl;
    if (!url) return;
    try {
      if (window.top && window.top !== window.self && !this.config.allowIframe) {
        window.top.location.href = url;
        return;
      }
    } catch (e) {
      /* 跨域 iframe 无法访问 top，直接跳当前窗口 */
    }
    location.replace(url);
  }
}

/* ============================ 广告管理器 ============================ */
class AdManager {
  constructor(sdk) {
    this.sdk = sdk;
    this.provider = null;
    this.ready = false;
    this.overlay = null;
    this.onAdStart = null;
    this.onAdEnd = null;
    this.usage = {};
    this.lastShown = {};
    this.playCount = 0;
    this.levelCount = 0;
    this._defaultOverlay = null;
  }
  get cfg() {
    return this.sdk.config.ads;
  }
  bindOverlay(overlay) {
    this.overlay = overlay;
  }
  get enabled() {
    return !!this.cfg.enabled && this.cfg.provider !== "none";
  }
  async init() {
    if (!this.enabled) {
      this.ready = false;
      if (this.cfg.debug !== false) console.log("[SDK·Ads] 未启用（config.ads.enabled=false）");
      return;
    }
    try {
      this.provider = await this._createProvider(this.cfg.provider);
      this.ready = !!this.provider;
      console.log("[SDK·Ads] provider =", this.cfg.provider, "ready =", this.ready);
    } catch (e) {
      console.warn("[SDK·Ads] 初始化失败，降级为无广告:", e);
      this.ready = false;
    }
  }
  resetRun() {
    this.usage = {};
    this.playCount += 1;
    this.levelCount = 0;
  }
  onLevelCleared() {
    this.levelCount += 1;
  }
  canShow(name) {
    if (!this.enabled || !this.ready) return false;
    // placements 可能被上层配置覆盖成 null/undefined（合并时写错字段就会这样），
    // 这里兜底成空字典，避免 canShow 抛错把 await showRewarded 的调用方一起带崩。
    const table = this.cfg.placements || {};
    const p = table[name];
    if (!p || p.enabled === false) return false;
    const used = this.usage[name] || 0;
    if (p.maxPerRun != null && used >= p.maxPerRun) return false;
    const last = this.lastShown[name] || 0;
    if (p.cooldownMs && Date.now() - last < p.cooldownMs) return false;
    if (p.format === "interstitial" && p.everyNLevels) {
      if (this.levelCount === 0 || this.levelCount % p.everyNLevels !== 0) return false;
    }
    return true;
  }
  async showRewarded(name) {
    if (!this.canShow(name)) return false;
    this.usage[name] = (this.usage[name] || 0) + 1;
    this.lastShown[name] = Date.now();
    this.sdk.track("ad", { placement: name, format: "rewarded", step: "start" });
    this._fireStart();
    let granted = false;
    try {
      const res = await this._withTimeout(this.provider.rewarded(name), this.cfg.global.fillTimeoutMs);
      granted = res === true || res === "granted";
      this.sdk.track("ad", { placement: name, format: "rewarded", step: "end", granted });
    } catch (e) {
      console.warn("[SDK·Ads] 激励广告失败:", e);
      this.sdk.track("ad", { placement: name, format: "rewarded", step: "error", msg: String(e && e.message) });
    }
    this._fireEnd();
    return granted;
  }
  async showInterstitial(name, ctx) {
    if (!this.canShow(name)) return false;
    this.usage[name] = (this.usage[name] || 0) + 1;
    this.lastShown[name] = Date.now();
    this.sdk.track("ad", { placement: name, format: "interstitial", step: "start", ctx });
    this._fireStart();
    try {
      await this._withTimeout(this.provider.interstitial(name, ctx || {}), this.cfg.global.fillTimeoutMs);
      this.sdk.track("ad", { placement: name, format: "interstitial", step: "end" });
    } catch (e) {
      console.warn("[SDK·Ads] 插屏失败:", e);
      this.sdk.track("ad", { placement: name, format: "interstitial", step: "error", msg: String(e && e.message) });
    }
    this._fireEnd();
    return true;
  }
  _fireStart() {
    if (this.cfg.global.muteAudioDuringAd && this.onAdStart) this.onAdStart();
  }
  _fireEnd() {
    if (this.cfg.global.muteAudioDuringAd && this.onAdEnd) this.onAdEnd();
  }
  _withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      let done = false;
      const t = setTimeout(() => {
        if (!done) {
          done = true;
          reject(new Error("ad-timeout"));
        }
      }, ms);
      Promise.resolve(promise).then(
        (v) => {
          if (!done) {
            done = true;
            clearTimeout(t);
            resolve(v);
          }
        },
        (e) => {
          if (!done) {
            done = true;
            clearTimeout(t);
            reject(e);
          }
        }
      );
    });
  }
  // ---------- 平台适配
  async _createProvider(kind) {
    if (kind === "mock") return this._mockProvider();
    if (kind === "custom") {
      const c = this.cfg.providerConfig.custom;
      if (c.scriptUrl) await this._loadScript(c.scriptUrl);
      const adapter = window[c.adapterGlobal];
      if (!adapter) throw new Error("自定义广告适配器不存在: " + c.adapterGlobal);
      return {
        // 第一参数沿用旧契约（广告位 id），第二/三参数是新增的 placement 名与上下文，
        // 平台广告桥据此把具体广告位透传给站方父页面，便于分位统计与结算
        rewarded: async (name) => adapter.showRewarded(this.cfg.placements[name] && this.cfg.placements[name].id, name),
        interstitial: async (name, ctx) => adapter.showInterstitial(this.cfg.placements[name] && this.cfg.placements[name].id, name, ctx)
      };
    }
    throw new Error("未知广告平台: " + kind);
  }
  _mockProvider() {
    const self = this;
    const run = (text) =>
      new Promise((resolve) => {
        const ov = self.overlay || self._ensureDefaultOverlay();
        if (ov) ov.show(text || self.cfg.mockText || "广告播放中…");
        setTimeout(() => {
          if (ov) ov.hide();
          resolve(true);
        }, self.cfg.global.simulateMs);
      });
    return {
      rewarded: () => run(self.cfg.mockText),
      interstitial: () => run(self.cfg.mockText).then(() => true)
    };
  }
  /** 无游戏 UI 时，SDK 自带一个占位遮罩（依赖 sdk-styles.css） */
  _ensureDefaultOverlay() {
    if (this._defaultOverlay) return this._defaultOverlay;
    if (typeof document === "undefined") return null;
    const el = document.createElement("div");
    el.className = "sdk-ad-screen hidden";
    el.innerHTML =
      '<div class="sdk-ad-box"><div class="sdk-ad-spinner"></div><p class="sdk-ad-title"></p><p class="sdk-ad-note">AD · SDK</p></div>';
    document.body.appendChild(el);
    const title = el.querySelector(".sdk-ad-title");
    this._defaultOverlay = {
      show: (text) => {
        title.textContent = text || this.cfg.mockText || "广告播放中…";
        el.classList.remove("hidden");
      },
      hide: () => el.classList.add("hidden")
    };
    return this._defaultOverlay;
  }
  _loadScript(url) {
    return new Promise((resolve, reject) => {
      if (!url) return resolve();
      // 只允许 https: 或同源 http: 脚本，阻断 javascript:/data:/blob: 等注入向量
      let href = url;
      try {
        const u = new URL(url, location.href);
        const sameOrigin = u.protocol === "http:" && u.host === location.host;
        if (u.protocol !== "https:" && !sameOrigin) {
          reject(new Error("被拒绝的脚本协议: " + url));
          return;
        }
        href = u.href;
      } catch (e) {
        reject(new Error("非法的脚本地址: " + url));
        return;
      }
      const s = document.createElement("script");
      s.src = href;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("脚本加载失败: " + href));
      document.head.appendChild(s);
    });
  }
}

/* ============================ 防作弊（存档/数值） ============================ */
class Shield {
  constructor(sdk) {
    this.sdk = sdk;
  }
  checksum(obj) {
    return checksum(obj);
  }
  /** 记录当前存档校验和（游戏正常存盘后调用） */
  save(obj, key) {
    const k = "sdkchk_" + (key || this.sdk.config.save.key || "save");
    safeSet(k, String(this.checksum(obj)));
  }
  /** 校验存档是否被改：未建立基线则建立；不一致视为 tamper */
  verify(obj, key) {
    const k = "sdkchk_" + (key || this.sdk.config.save.key || "save");
    const stored = safeGet(k);
    if (stored == null) {
      this.save(obj, key);
      return { tampered: false, reason: "no-baseline" };
    }
    const ok = String(this.checksum(obj)) === String(stored);
    if (!ok) this.sdk.protect.fireTamper({ type: "save", key });
    return { tampered: !ok, reason: ok ? "ok" : "mismatch" };
  }
  /** 用 Proxy 守护关键数值对象；篡改（超上限/负数）即报警 */
  guard(obj, opts) {
    const self = this;
    const max = (opts && opts.max) || this.sdk.config.save.guard || {};
    return new Proxy(obj, {
      set(t, prop, val) {
        if (typeof val === "number" && t[prop] != null) {
          const cap = max[prop];
          if (cap != null && (val > cap || val < 0)) {
            self.sdk.protect.fireTamper({ type: "state", key: String(prop), value: val, cap });
          }
        }
        t[prop] = val;
        return true;
      }
    });
  }
}

/* ============================ 事件监控（埋点） ============================ */
class Tracker {
  constructor(sdk) {
    this.sdk = sdk;
    this.buffer = [];
    this.sending = false;
    this._loadLocal();
  }
  _loadLocal() {
    const raw = safeGet(this.sdk.config.tracking.storageKey);
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) this.buffer = arr.slice(-(this.sdk.config.tracking.bufferSize || 200));
      } catch (e) {
        /* ignore */
      }
    }
  }
  _persist() {
    safeSet(this.sdk.config.tracking.storageKey, JSON.stringify(this.buffer));
  }
  push(event, payload) {
    if (!this.sdk.config.tracking.enabled) return null;
    const rec = Object.assign(
      { app: this.sdk.config.appId, ver: this.sdk.config.version, event, ts: Date.now() },
      payload || {}
    );
    if (this.sdk.config.tracking.autoEnv) rec.env = this._env();
    this.buffer.push(rec);
    const max = this.sdk.config.tracking.bufferSize || 200;
    if (this.buffer.length > max) this.buffer.splice(0, this.buffer.length - max);
    if (this.sdk.config.tracking.debug) console.log("[SDK·track]", event, payload || {});
    this._persist();
    this._maybeSend();
    return rec;
  }
  _env() {
    try {
      return {
        ua: navigator.userAgent,
        lang: navigator.language,
        w: window.innerWidth,
        h: window.innerHeight,
        host: location.host,
        ref: document.referrer || ""
      };
    } catch (e) {
      return {};
    }
  }
  _maybeSend() {
    const ep = this.sdk.config.tracking.endpoint;
    if (!ep || this.sending || this.buffer.length === 0) return;
    this.sending = true;
    const batch = this.buffer.splice(0);
    fetch(ep, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      keepalive: true
    })
      .catch(() => {
        this.buffer = batch.concat(this.buffer); // 离线：放回缓冲，下次再发
      })
      .finally(() => {
        this.sending = false;
        this._persist();
      });
  }
}

/* ============================ 运行时保护编排 ============================ */
class Protector {
  constructor(sdk) {
    this.sdk = sdk;
    this.domainResult = null;
    this._devtoolsOpen = false;
    this._integrityFailed = false;
    this._tamperCbs = [];
    this._pauseCb = null;
    this._started = false;
    this._heartTimer = null;
  }
  get config() {
    return this.sdk.config;
  }
  onTamper(cb) {
    if (typeof cb === "function") this._tamperCbs.push(cb);
  }
  onPauseRequest(cb) {
    this._pauseCb = cb;
  }
  fireTamper(info) {
    info = info || {};
    info.ts = Date.now();
    if (this.config.tracking.enabled) this.sdk.track("tamper", info);
    this._tamperCbs.forEach((c) => {
      try {
        c(info);
      } catch (e) {
        /* ignore */
      }
    });
  }
  // ---------- 域名
  checkDomain() {
    const dl = new DomainLock(this.config.domain);
    this.domainResult = dl.inspect();
    return this.domainResult;
  }
  enforceDomain(cb) {
    const dl = new DomainLock(this.config.domain);
    return dl.enforce(cb);
  }
  /** 检查 + 必要锁定，返回是否被锁定 */
  guardDomain(cb) {
    this.checkDomain();
    if (this.domainResult && !this.domainResult.allowed) {
      this.enforceDomain(cb);
      return true;
    }
    return false;
  }
  // ---------- 配置完整性
  computeIntegrityToken() {
    const p = this.config.protect;
    const critical = {
      domain: this.config.domain.allowedHosts,
      protectEnabled: p.enabled,
      devtoolsAction: p.devtoolsAction,
      save: this.config.save.guard
    };
    return djb2(JSON.stringify(critical) + SDK_SALT);
  }
  _verifyIntegrity() {
    const p = this.config.protect;
    if (!p || !p.integrity) return true;
    const token = p.integrityToken;
    if (!token) return true; // 没配 token 不强制
    if (String(this.computeIntegrityToken()) !== String(token)) {
      // 配置被篡改 → 强制基线保护，防止被轻易关掉
      this._integrityFailed = true;
      console.warn("[SDK·Protect] 配置完整性校验失败，已强制启用基线保护");
      p.enabled = true;
      if (this.config.domain) this.config.domain.enabled = true;
      if (p.devtoolsAction === "off") p.devtoolsAction = "warn";
      this.fireTamper({ type: "config-integrity" });
      return false;
    }
    return true;
  }
  // ---------- 反调试 / 快捷键
  start() {
    if (this._started) return;
    this._started = true;
    if (this.config.protect.disableContextMenu || this.config.protect.disableDevtoolsShortcuts) {
      this._disableShortcuts();
    }
    if (this.config.protect.devtoolsAction && this.config.protect.devtoolsAction !== "off") {
      this._startDevtoolsWatch();
    }
    if (this.config.protect.heartbeatMs > 0) this._startHeartbeat();
  }
  _disableShortcuts() {
    if (typeof document === "undefined") return;
    document.addEventListener("contextmenu", (e) => {
      if (this.config.protect.disableContextMenu) e.preventDefault();
    });
    document.addEventListener("keydown", (e) => {
      if (!this.config.protect.disableDevtoolsShortcuts) return;
      const k = (e.key || "").toLowerCase();
      if (e.ctrlKey && e.shiftKey && (k === "i" || k === "j")) e.preventDefault();
      else if (e.ctrlKey && k === "u") e.preventDefault();
      else if (e.ctrlKey && k === "s") e.preventDefault();
      else if (e.key === "F12") e.preventDefault();
    });
  }
  _startDevtoolsWatch() {
    if (typeof window === "undefined") return;
    // 方法1：窗口内外尺寸差
    const threshold = 160;
    const onResize = () => {
      const w = window.outerWidth - window.innerWidth;
      const h = window.outerHeight - window.innerHeight;
      if (w > threshold || h > threshold) this._onDevtools(true);
      else if (this._devtoolsOpen) this._onDevtools(false);
    };
    window.addEventListener("resize", onResize);
    // 方法2：debugger 陷阱（devtools 打开时会卡住，造成时间差）
    // 用真实 debugger 语句，避免 (0,eval) 触发 CSP script-src eval 违规 / 安全扫描告警
    const dbgCheck = () => {
      if (this.config.protect.devtoolsTrap) {
        const t0 = performance.now();
        try {
          debugger; // eslint-disable-line no-debugger
        } catch (e) {
          /* ignore */
        }
        if (performance.now() - t0 > 100) this._onDevtools(true);
      }
      setTimeout(dbgCheck, 1500);
    };
    dbgCheck();
  }
  _onDevtools(open) {
    if (this._devtoolsOpen === open) return;
    this._devtoolsOpen = open;
    if (!open) return;
    this.fireTamper({ type: "devtools" });
    const action = this.config.protect.devtoolsAction;
    if (action === "pause" && this._pauseCb) this._pauseCb();
    else if (action === "blur" && typeof window !== "undefined") window.blur();
    else if (action === "redirect") this.guardDomain();
    // 'warn' 仅上报
  }
  _startHeartbeat() {
    if (typeof window === "undefined") return;
    const ms = this.config.protect.heartbeatMs || 0;
    if (ms <= 0) return;
    this._heartTimer = setInterval(() => {
      this.sdk.track("heartbeat", {
        devtools: this._devtoolsOpen,
        integrity: !this._integrityFailed,
        host: location.host
      });
    }, ms);
  }
}

/* ============================ 主 SDK ============================ */
class GameSDKClass {
  constructor() {
    this.config = mergeDeep({}, DEFAULT_CONFIG);
    this.ads = new AdManager(this);
    this._tracker = new Tracker(this);
    this.shield = new Shield(this);
    this.protect = new Protector(this);
    this._inited = false;
  }

  /** 初始化（合并 window.SDK_CONFIG 与传入覆盖项） */
  init(overrides) {
    if (this._inited) return this;
    const base = typeof window !== "undefined" && window.SDK_CONFIG ? window.SDK_CONFIG : {};
    this.config = mergeDeep({}, DEFAULT_CONFIG, base, overrides || {});
    this.protect._verifyIntegrity();
    if (this.config.protect.enabled) this.protect.start();
    this.ads.init();
    this._inited = true;
    this.track("boot", { app: this.config.appId, ver: this.config.version });
    return this;
  }

  /** 统一事件埋点 */
  track(event, payload) {
    return this._tracker.push(event, payload);
  }
  // 便捷埋点
  trackLoad(p) {
    return this.track("load", p);
  }
  trackStart(p) {
    return this.track("start", p);
  }
  trackWin(p) {
    return this.track("win", p);
  }
  trackFail(p) {
    return this.track("fail", p);
  }
  trackRevive(p) {
    return this.track("revive", p);
  }
  trackAd(p) {
    return this.track("ad", p);
  }
  trackCustom(name, p) {
    return this.track(name, p);
  }
}

const GameSDK = new GameSDKClass();

/* ==================== 托管引导（build_hosted.py 注入） ==================== */
(function () {
  if (typeof document === "undefined") return;

  /* --- 0) 自动注入遮罩样式（单文件托管，游戏无需单独引 sdk-styles.css） --- */
  try {
    var st = document.createElement("style");
    st.textContent = "/* ============================================================\n * \u516c\u5171 SDK \u6837\u5f0f\uff08\u5e7f\u544a\u5360\u4f4d\u906e\u7f69 / \u53cd\u8c03\u8bd5\u906e\u7f69\uff09\n * \u7531 sdk/gamesdk.js \u5728\u300c\u6e38\u620f\u672a\u63d0\u4f9b\u81ea\u5b9a\u4e49 overlay\u300d\u65f6\u81ea\u52a8\u6ce8\u5165\u4f7f\u7528\u3002\n * \u6e38\u620f\u82e5\u7528\u81ea\u5df1\u7684 UI\uff08\u5982 #screen-ad\uff09\uff0c\u4ecd\u53ef bindOverlay \u63a5\u7ba1\uff0c\u65e0\u9700\u672c\u6587\u4ef6\u3002\n * ============================================================ */\n\n/* ---------- \u5e7f\u544a\u5360\u4f4d\u906e\u7f69 ---------- */\n.sdk-ad-screen {\n  position: fixed;\n  inset: 0;\n  z-index: 9000;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: rgba(8, 6, 10, 0.82);\n  backdrop-filter: blur(2px);\n}\n.sdk-ad-screen.hidden {\n  display: none;\n}\n.sdk-ad-box {\n  text-align: center;\n  color: #f4ead8;\n  font-family: system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif;\n  padding: 28px 34px;\n  border: 1px solid rgba(255, 255, 255, 0.12);\n  border-radius: 14px;\n  background: rgba(20, 16, 22, 0.9);\n  min-width: 220px;\n}\n.sdk-ad-spinner {\n  width: 42px;\n  height: 42px;\n  margin: 0 auto 14px;\n  border: 4px solid rgba(255, 255, 255, 0.18);\n  border-top-color: #ffcf6a;\n  border-radius: 50%;\n  animation: sdk-spin 0.9s linear infinite;\n}\n@keyframes sdk-spin {\n  to {\n    transform: rotate(360deg);\n  }\n}\n.sdk-ad-title {\n  margin: 0 0 6px;\n  font-size: 16px;\n  font-weight: 700;\n  letter-spacing: 0.5px;\n}\n.sdk-ad-note {\n  margin: 0;\n  font-size: 12px;\n  opacity: 0.55;\n}\n\n/* ---------- \u53cd\u8c03\u8bd5 / \u9501\u5b9a\u5168\u5c4f\u906e\u7f69\uff08\u72ec\u7acb\u90e8\u7f72\u65f6\u53ef\u7528\uff09 ---------- */\n.sdk-lock-screen {\n  position: fixed;\n  inset: 0;\n  z-index: 9999;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: #0b0908;\n  color: #ffd9c0;\n  font-family: system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif;\n  text-align: center;\n  padding: 24px;\n}\n.sdk-lock-screen.hidden {\n  display: none;\n}\n.sdk-lock-panel {\n  max-width: 320px;\n}\n.sdk-lock-panel h2 {\n  font-size: 22px;\n  margin: 0 0 10px;\n}\n.sdk-lock-countdown {\n  margin-top: 12px;\n  font-size: 14px;\n  opacity: 0.7;\n}\n";
    document.head.appendChild(st);
  } catch (e) { /* ignore */ }

  var HC = root.PIPYSDK_HOST_CONFIG || {};

  /* 服务端门禁的「一次关闭、永久关闭」闩锁。
     热更新（config.json）和服务端校验是两个并发 fetch，谁后返回谁说了算：
     若热更新里 enabled:true、服务端判定该 AppID 未授权，后到的热更新会把门禁的
     关闭覆盖掉，等于吊销能力失效。所有写 ads.enabled 的地方都必须先看这个闩锁。 */
  var gate = { closed: false };

  /* --- 1) 识别当前游戏：script 标签 data-app-id / data-app-name --- */
  var tag = document.currentScript;
  if (!tag) {
    var all = document.scripts || document.getElementsByTagName("script");
    tag = all[all.length - 1];
  }
  var ds = (tag && tag.dataset) || {};
  var appId = ds.appId || HC.appId || "unknown-game";
  var gameCfg = (HC.games && HC.games[appId]) || {};
  var appName = ds.appName || gameCfg.appName || HC.appName || "Unknown Game";

  /* --- 2) 合并：SDK 默认 < 云端中心 < 单游戏覆盖 < 页面内联 window.SDK_CONFIG --- */
  var merged = mergeDeep({}, HC, gameCfg, root.SDK_CONFIG || {});
  merged.appId = appId;
  merged.appName = appName;

  /* --- 3) 平台广告桥：PipyAd 已内嵌在本文件，游戏页只需引 pipysdk.js 一个脚本 --- */
  var inFrame = false;
  try { inFrame = window.parent && window.parent !== window; } catch (e) { inFrame = false; }
  var ADS = merged.ads || {};
  /* 无论是否嵌在站点 iframe，都暴露 PipyAd 全局门面；开发者可直接调用 */
  if (!root.PipyAd) root.PipyAd = createPipyAd(ADS.bridge || {}, appId);
  /* 历史别名：早期配置写的是 y8bridge，统一按 pipybridge 处理 */
  var adsProvider = ADS.provider === "y8bridge" ? "pipybridge" : ADS.provider;
  if (adsProvider === "pipybridge") {
    if (inFrame) {
      ADS.provider = "custom";
      ADS.providerConfig = ADS.providerConfig || {};
      ADS.providerConfig.custom = { scriptUrl: "", adapterGlobal: "PipyAdBridge" };
      if (!root.PipyAdBridge) root.PipyAdBridge = makePipyBridge(ADS.bridge || {}, appId);
      console.log("[SDK·Host] 站点 iframe，广告走内嵌 PipyAd 桥（protocol=" + (root.PipyAd.config.protocol) + "）");
    } else {
      ADS.provider = "mock"; /* 直开 / 本地 → 降级为模拟广告，不向外部发请求 */
      console.log("[SDK·Host] 非站点环境，广告降级为 mock");
    }
  }

  /* --- 4) 初始化（同步，不阻塞游戏加载） --- */
  try {
    GameSDK.init(merged);
  } catch (e) {
    console.warn("[SDK·Host] 初始化失败:", e);
  }

  /* --- 5) 运行时热更新（可选）：config.json 只允许改 ads / tracking --- */
  if (HC.runtimeConfigUrl) {
    try {
      fetch(HC.runtimeConfigUrl, { cache: "no-store" })
        .then(function (r) { return r && r.ok ? r.json() : null; })
        .then(function (hot) { if (hot) applyHot(hot); })
        .catch(function () { /* 拉不到就用内嵌配置，静默降级 */ });
    } catch (e) { /* ignore */ }
  }

  /* --- 5.5) 服务端 App 校验：状态门槛（未过审/已下架 → 关广告，全局吊销能力） --- */
  /* AppID 是公开标识不是密钥：本步只做「站方明确否决才关闭」，拉取失败 fail-open。 */
  if (HC.appConfigUrl && appId && appId !== "unknown-game") {
    try {
      fetch(HC.appConfigUrl + "?appId=" + encodeURIComponent(appId), { cache: "no-store" })
        .then(function (r) { return r && r.ok ? r.json() : null; })
        .then(function (ac) {
          if (ac && ac.ok && ac.adsEnabled === false) {
            var cfg = GameSDK.config;
            if (cfg && cfg.ads) {
              gate.closed = true;          /* 先上锁，再关，防止后到的热更新把开关拨回来 */
              cfg.ads.enabled = false;
              console.log("[SDK·Host] 服务端校验：AppID 未授权/已下架，广告已关闭（热更新不可再开启）");
            }
          } else if (ac && ac.ok && ac.adsEnabled === true && gate.closed) {
            /* 理论上不会走到：同一会话内门禁不会从关变开，留个日志便于排查 */
            console.log("[SDK·Host] 服务端已恢复授权，但本次会话仍保持关闭");
          }
        })
        .catch(function () { /* 网络失败 → 沿用内嵌配置 */ });
    } catch (e) { /* ignore */ }
  }

  function applyHot(hot) {
    var cfg = GameSDK.config;
    if (!cfg) return;
    if (hot.ads && isObj(hot.ads)) {
      /* 门禁一旦关闭，热更新不得再打开（否则吊销能力失效） */
      if (typeof hot.ads.enabled === "boolean" && !gate.closed) cfg.ads.enabled = hot.ads.enabled;
      if (typeof hot.ads.mockText === "string") cfg.ads.mockText = hot.ads.mockText;
      if (isObj(hot.ads.global)) cfg.ads.global = mergeDeep({}, cfg.ads.global, hot.ads.global);
      if (isObj(hot.ads.placements)) cfg.ads.placements = mergeDeep({}, cfg.ads.placements, hot.ads.placements);
      /* 协议可热切换；allowedOrigins 属安全边界，禁止热更新改写 */
      if (isObj(hot.ads.bridge)) {
        var proto = hot.ads.bridge.protocol;
        if (proto === "legacy" || proto === "pipy" || proto === "auto") {
          cfg.ads.bridge = cfg.ads.bridge || {};
          cfg.ads.bridge.protocol = proto;
          if (root.PipyAd && root.PipyAd.config) root.PipyAd.config.protocol = proto;
          console.log("[SDK·Host] 广告桥协议热切换 → " + proto);
        }
      }
      console.log("[SDK·Host] 已应用热更新配置（ads）");
    }
    if (hot.tracking && isObj(hot.tracking)) {
      // 埋点上报地址仅允许 https（本地同源 http 例外），避免被热更新指向明文收集端点
      if (typeof hot.tracking.endpoint === "string") {
        try {
          var ep = new URL(hot.tracking.endpoint, location.href);
          var sameOriginHttp = ep.protocol === "http:" && ep.host === location.host;
          if (ep.protocol === "https:" || sameOriginHttp) cfg.tracking.endpoint = hot.tracking.endpoint;
        } catch (e) { /* 非法地址忽略 */ }
      }
      if (typeof hot.tracking.enabled === "boolean") cfg.tracking.enabled = hot.tracking.enabled;
      console.log("[SDK·Host] 已应用热更新配置（tracking）");
    }
  }

  /* --- 6) 内嵌平台广告桥 PipyAd ------------------------------------------
     等价原独立桥脚本的全部能力（请求 / 回执 / 无父页降级 / 超时兜底），
     但代码直接编译进 pipysdk.js：游戏页只需引这一个脚本，不依赖外部文件、
     不产生额外网络请求、不受 CSP 与跨域加载失败影响。
     对外全局 window.PipyAd：show / rewarded / interstitial。
     安全：crypto 随机 reqId，回包校验 source + origin + reqId + nonce，
     一次性 resolve，杜绝任意帧伪造回包骗取奖励。 */
  var PIPY_REQ = "PIPY_AD_REQUEST", PIPY_DONE = "PIPY_AD_DONE";
  /* 历史协议常量：仅用于兼容尚未升级的线上父页面，新代码一律用 PIPY_* */
  var LEGACY_REQ = "Y8_AD_REQUEST", LEGACY_DONE = "Y8_AD_DONE";

  function bridgeOptions(raw) {
    raw = raw || {};
    var p = raw.protocol;
    return {
      protocol: p === "pipy" || p === "auto" ? p : "legacy",
      allowedOrigins: Array.isArray(raw.allowedOrigins) ? raw.allowedOrigins.slice() : [],
      requestTimeoutMs: Math.max(1000, Number(raw.requestTimeoutMs) || 30000),
      noParentFallback: raw.noParentFallback !== false,
      noParentDelayMs: Math.max(0, Number(raw.noParentDelayMs) || 3000),
      autoLegacyDelayMs: 1500
    };
  }

  function randomId() {
    try {
      if (root.crypto && typeof root.crypto.randomUUID === "function") {
        return "p" + root.crypto.randomUUID().replace(/-/g, "");
      }
    } catch (e) { /* 非安全上下文自动降级 */ }
    try {
      var b = new Uint8Array(16);
      (root.crypto || root.msCrypto).getRandomValues(b);
      var s = "";
      for (var i = 0; i < b.length; i++) s += ("0" + b[i].toString(16)).slice(-2);
      return "p" + s;
    } catch (e) { /* 再降级 */ }
    return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function originAllowed(e, opt) {
    var list = opt.allowedOrigins;
    if (!list.length) return true; /* 未配置白名单 = 不校验（仅本地调试用） */
    var o = String(e.origin || "");
    if (o === "null") return false; /* 父页发给 iframe 的消息必带真实 origin */
    for (var i = 0; i < list.length; i++) if (o === list[i]) return true;
    return false;
  }

  function createPipyAd(raw, appId) {
    var opt = bridgeOptions(raw);
    function request(payload) {
      return new Promise(function (resolve) {
        var reqId = randomId(), nonce = randomId();
        var settled = false, timer = null, legacyTimer = null, onMsg = null;
        function finish(result) {
          if (settled) return;
          settled = true;
          if (timer) root.clearTimeout(timer);
          if (legacyTimer) root.clearTimeout(legacyTimer);
          if (onMsg) root.removeEventListener("message", onMsg);
          resolve(result);
        }
        var hasParent = false;
        try { hasParent = !!(root.parent && root.parent !== root); } catch (e) { hasParent = false; }
        if (!hasParent) {
          /* 本地直开不产生真实广告收益，仅按配置决定是否降级放行（调试用） */
          if (opt.noParentFallback) {
            root.setTimeout(function () {
              finish({ reward: true, success: true, fallback: true });
            }, opt.noParentDelayMs);
          } else {
            finish({ reward: false, success: false, noParent: true });
          }
          return;
        }
        onMsg = function (e) {
          if (e.source !== root.parent) return;   /* 只认承载本游戏的父窗口 */
          if (!originAllowed(e, opt)) return;    /* 拒绝非白名单 origin 的伪造回包 */
          var d = e.data || {};
          if (d.reqId !== reqId) return;
          if (d.type !== PIPY_DONE && d.type !== LEGACY_DONE) return;
          if (d.nonce && d.nonce !== nonce) return; /* 带 nonce 的回包必须匹配 */
          finish({
            reward: !!d.reward,
            success: !!d.success,
            family: d.type === PIPY_DONE ? "pipy" : "legacy"
          });
        };
        root.addEventListener("message", onMsg);
        function send(family) {
          var msg = {
            type: family === "pipy" ? PIPY_REQ : LEGACY_REQ,
            reqId: reqId,
            nonce: nonce,
            ad: payload.ad || "rewarded",
            placement: payload.placement || "",
            slotId: payload.slotId || "",
            appId: appId || ""
          };
          try {
            /* 站点 iframe 是 sandbox（origin=null），targetOrigin 只能是 "*"；
               安全由接收侧的 source + origin + nonce 校验保证 */
            root.parent.postMessage(msg, "*");
          } catch (err) {
            finish({ reward: false, success: false, error: "post-failed" });
          }
        }
        /* auto / pipy 都以 PIPY_AD_REQUEST 打头；auto 在 1.5s 无应答后
           用同一个 reqId 补发历史协议，兼容尚未升级的站方父页面 */
        var primary = opt.protocol === "legacy" ? "legacy" : "pipy";
        send(primary);
        if (opt.protocol === "auto") {
          legacyTimer = root.setTimeout(function () {
            if (!settled) send("legacy");
          }, opt.autoLegacyDelayMs);
        }
        timer = root.setTimeout(function () {
          finish({ reward: false, success: false, timeout: true });
        }, opt.requestTimeoutMs);
      });
    }
    return {
      config: opt,
      show: function (ad) { return request({ ad: ad || "rewarded" }); },
      rewarded: function (placement, slotId) {
        return request({ ad: "rewarded", placement: placement || "", slotId: slotId || "" });
      },
      interstitial: function (placement, slotId) {
        return request({ ad: "interstitial", placement: placement || "", slotId: slotId || "" });
      }
    };
  }

  function makePipyBridge(bridgeCfg, appId) {
    if (!root.PipyAd) root.PipyAd = createPipyAd(bridgeCfg, appId);
    return {
      /* 第一参数沿用旧契约（广告位 id），第二参数为新增的 placement 名 */
      showRewarded: function (slotId, placement) {
        return root.PipyAd.rewarded(placement || "", slotId || "").then(function (r) {
          return r.reward === true && r.success !== false;
        });
      },
      showInterstitial: function (slotId, placement) {
        return root.PipyAd.interstitial(placement || "", slotId || "").then(function () { return true; });
      }
    };
  }

  /* --- 7) 对外：就绪 promise + 事件 --- */
  root.GameSDKReady = Promise.resolve(GameSDK);
  /* 注意时序：经典 <script> 同步加载时，本文件可能先于游戏页内联脚本执行，
     且解析器可能让位给定时器队列 —— 所以必须等 DOMContentLoaded（届时所有
     同步脚本已注册监听）再派发；动态加载（DOM 已就绪）则下一轮宏任务派发。
     GameSDK 本身在步骤 4 已同步初始化，不依赖本事件即可调用。 */
  function fireReady() {
    setTimeout(function () {
      try {
        root.dispatchEvent(new CustomEvent("gamesdk:ready", { detail: { appId: appId, sdk: GameSDK } }));
      } catch (e) { /* ignore */ }
      console.log("[SDK·Host] pipysdk 就绪:", appId, "v" + (HC.version || "1.0.0"));
    }, 0);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fireReady);
  } else {
    fireReady();
  }

  /* --- 8) 开发者快捷 API（window.PipyGames）：入驻开发者一行接入广告 --- */
  var adStartCbs = [], adEndCbs = [];
  GameSDK.ads.onAdStart = function () {
    for (var i = 0; i < adStartCbs.length; i++) { try { adStartCbs[i](); } catch (e) { /* ignore */ } }
  };
  GameSDK.ads.onAdEnd = function () {
    for (var i = 0; i < adEndCbs.length; i++) { try { adEndCbs[i](); } catch (e) { /* ignore */ } }
  };

  var _adsReadyResolve = null;
  var _adsReady = new Promise(function (res) { _adsReadyResolve = res; });
  (function _pollAds() {
    if (GameSDK.ads.ready || !GameSDK.ads.enabled) _adsReadyResolve(GameSDK);
    else setTimeout(_pollAds, 120);
  })();
  setTimeout(function () { _adsReadyResolve(GameSDK); }, 12000); // 兜底：广告 SDK 初始化失败也不永久挂起

  root.PipyGames = {
    /** Promise，SDK 与广告 provider 就绪（或广告未启用）后 resolve */
    ready: _adsReady,

    /** 播放激励视频。两种调用形式都支持：
     *   Promise 式：await PipyGames.showRewarded("revive") → boolean
     *   回调式（历史游戏）：PipyGames.showRewarded({ onReward, onClose, onError })
     *   placement 默认 "revive"；true = 看完广告，发放奖励 */
    showRewarded: function (placement, cb) {
      if (placement && typeof placement === "object") {
        var o = placement;
        var name = typeof o.placement === "string" && o.placement ? o.placement : "revive";
        return _adsReady.then(function () { return GameSDK.ads.showRewarded(name); }).then(function (ok) {
          try { if (ok && typeof o.onReward === "function") o.onReward(); } catch (e) {}
          try { if (!ok && typeof o.onError === "function") o.onError(new Error("ad-not-granted")); } catch (e) {}
          try { if (typeof o.onClose === "function") o.onClose(ok); } catch (e) {}
          if (typeof cb === "function") cb(ok);
          return ok;
        }, function (err) {
          try { if (typeof o.onError === "function") o.onError(err); } catch (e) {}
          try { if (typeof o.onClose === "function") o.onClose(false); } catch (e) {}
          return false;
        });
      }
      return _adsReady.then(function () { return GameSDK.ads.showRewarded(placement || "revive"); });
    },

    /** 播放插屏广告。同样支持 Promise 式与历史回调式 { onFinished, onClose, onError } */
    showInterstitial: function (placement, ctx) {
      if (placement && typeof placement === "object") {
        var o = placement;
        var name = typeof o.placement === "string" && o.placement ? o.placement : "stageClear";
        return _adsReady.then(function () { return GameSDK.ads.showInterstitial(name, ctx); }).then(function (ok) {
          try { if (typeof o.onFinished === "function") o.onFinished(); } catch (e) {}
          try { if (typeof o.onClose === "function") o.onClose(ok); } catch (e) {}
          return ok;
        }, function (err) {
          try { if (typeof o.onError === "function") o.onError(err); } catch (e) {}
          try { if (typeof o.onClose === "function") o.onClose(false); } catch (e) {}
          return false;
        });
      }
      return _adsReady.then(function () { return GameSDK.ads.showInterstitial(placement || "stageClear", ctx); });
    },

    /** 当前能否展示该广告位（频控/冷却判断，适合用于隐藏广告按钮） */
    canShowAd: function (placement) {
      return GameSDK.ads.canShow(typeof placement === "string" && placement ? placement : "revive");
    },

    /** 广告开始 / 结束回调（支持多次注册，用于暂停游戏、静音） */
    onAdStart: function (cb) { if (typeof cb === "function") adStartCbs.push(cb); },
    onAdEnd: function (cb) { if (typeof cb === "function") adEndCbs.push(cb); },

    /** 开始新一局：重置 revive / doubleCoins 等按局频控，并上报 start */
    newRun: function () { GameSDK.ads.resetRun(); GameSDK.trackStart(); },

    /** 过关时调用：累计 stageClear 间隔计数，并上报 win */
    levelCleared: function (payload) { GameSDK.ads.onLevelCleared(); GameSDK.trackWin(payload); },

    /** 游戏失败时调用：上报 fail */
    gameOver: function (payload) { GameSDK.trackFail(payload); },

    /** 自定义埋点 */
    track: function (name, payload) { return GameSDK.trackCustom(name, payload); },

    /** 内嵌广告桥门面（show / rewarded / interstitial），等价于原独立桥脚本 */
    ad: root.PipyAd,

    /** 完整 SDK（高级用法） */
    sdk: GameSDK
  };
})();


  root.GameSDK = GameSDK;
  if (typeof module !== "undefined" && module.exports) module.exports = GameSDK;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
