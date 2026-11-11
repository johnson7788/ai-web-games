/* 自动生成：请勿手改。源码在 src/gamesdk.js，用 tools/build_dist.py 重新生成。 */
;(function (root) {
"use strict";

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
    const p = this.cfg.placements[name];
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

  root.GameSDK = GameSDK;
  if (typeof module !== "undefined" && module.exports) module.exports = GameSDK;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
