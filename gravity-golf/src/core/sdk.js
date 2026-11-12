// src/core/sdk.js — 门户 SDK 唯一出口
// 职责：加载 pipysdk（本地 vendored 或线上）、就绪等待、广告/埋点/存档/分享，全部带降级。
// 依赖：config/sdk.config.js（唯一配置源）。
// 调用方：main.js 与各模块；业务代码禁止直接碰 window.PipyGames / localStorage。
// 降级：脚本超时、域名被拦、SDK 未注入 → available=false，所有方法安全失败（返回 false/默认值）。
import { SDC } from '../../config/sdk.config.js';

const state = {
  loading: null,
  ready: false,
  used: new Map(),      // placement -> 本局已用次数
  lastInterstitial: 0,
  listeners: { adStart: [], adEnd: [] },
};

function pg() {
  return typeof window !== 'undefined' ? window.PipyGames || null : null;
}

function storageKey(key) {
  return `${SDC.save.keyPrefix}:${key}`;
}

/** 仅存档用：localStorage 兜底，隐私模式静默失败 */
function rawGet(key) {
  try { return window.localStorage.getItem(storageKey(key)); } catch { return null; }
}
function rawSet(key, value) {
  try { window.localStorage.setItem(storageKey(key), value); } catch { /* 隐私模式 */ }
}

/** 注入 pipysdk 脚本；已存在则直通。超时或失败返回 null。 */
function injectSdk() {
  if (pg()) return Promise.resolve(pg());
  if (state.loading) return state.loading;
  state.loading = new Promise((resolve) => {
    if (typeof document === 'undefined') { resolve(null); return; }
    const existing = document.querySelector('script[data-pipysdk]');
    if (existing) {
      const t = setTimeout(() => resolve(pg()), SDC.loadTimeoutMs);
      existing.addEventListener('load', () => { clearTimeout(t); resolve(pg()); });
      existing.addEventListener('error', () => { clearTimeout(t); resolve(null); });
      return;
    }
    const script = document.createElement('script');
    script.src = SDC.source === 'local' ? SDC.localUrl : SDC.sdkUrl;
    script.dataset.appId = SDC.appId;
    script.dataset.pipysdk = '1';
    script.defer = true;
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(pg()), SDC.loadTimeoutMs);
    script.onload = () => finish(pg());
    script.onerror = () => finish(null);
    document.head.appendChild(script);
  });
  return state.loading;
}

function emit(kind) {
  for (const fn of state.listeners[kind]) {
    try { fn(); } catch { /* 监听器异常不影响游戏 */ }
  }
}

const API_NAMES = ['showRewarded', 'showInterstitial', 'canShowAd', 'newRun', 'levelCleared', 'gameOver', 'track'];

export const Sdk = {
  /** SDK 是否真的可用（false = 本地降级模式） */
  get available() { return !!pg(); },

  /** 等待 SDK 就绪；永不挂起（loadTimeoutMs 兜底）。 */
  async ready() {
    await injectSdk();
    const api = pg();
    if (!api) return null;
    try {
      await Promise.race([api.ready, new Promise((r) => setTimeout(r, SDC.loadTimeoutMs))]);
      state.ready = true;
      for (const name of API_NAMES) {
        if (typeof api[name] === 'function') continue;
      }
    } catch { /* ready 失败按降级处理 */ }
    return api;
  },

  /** 自定义埋点；SDK 不可用时不抛错。 */
  track(name, payload = {}) {
    if (SDC.tracking && SDC.tracking.enabled === false) return;
    try { pg()?.track?.(name, payload); } catch { /* 埋点失败不影响玩法 */ }
  },

  /** 开局：清空按局频控 + track('start')。 */
  newRun(payload = {}) {
    state.used.clear();
    try { pg()?.newRun?.(payload); } catch { /* noop */ }
    this.track('start', payload);
  },

  /** 过关：track('win') + 插屏频控计数。 */
  levelCleared(payload = {}) {
    try { pg()?.levelCleared?.(payload); } catch { /* noop */ }
    this.track('win', payload);
  },

  /** 失败：track('fail')。 */
  gameOver(payload = {}) {
    try { pg()?.gameOver?.(payload); } catch { /* noop */ }
    this.track('fail', payload);
  },

  /** 广告是否可用（配置关闭时恒为 false）。 */
  canShowAd(placement, ctx = {}) {
    if (!SDC.ads || SDC.ads.enabled !== true) return false;
    const rule = SDC.ads.placements?.[placement];
    if (!rule) return false;
    if (rule.maxPerRun != null && (state.used.get(placement) ?? 0) >= rule.maxPerRun) return false;
    if (rule.cooldownMs && Date.now() - (state.lastInterstitial ?? 0) < rule.cooldownMs) return false;
    const api = pg();
    if (!api) return false;
    try { return api.canShowAd?.(placement, ctx) !== false; } catch { return false; }
  },

  /** 激励视频：true 才发奖；任何失败路径都返回 false。 */
  async showRewarded(placement, ctx = {}) {
    if (!this.canShowAd(placement, ctx)) return false;
    const api = pg();
    if (!api) return false;
    state.used.set(placement, (state.used.get(placement) ?? 0) + 1);
    emit('adStart');
    let ok = false;
    try {
      ok = await Promise.race([
        api.showRewarded?.(placement, ctx),
        new Promise((r) => setTimeout(() => r(false), SDC.ads.fillTimeoutMs ?? 9000)),
      ]);
    } catch { ok = false; }
    emit('adEnd');
    this.track('ad_show', { placement, ok: !!ok });
    return ok === true;
  },

  /** 插屏：内部频控（每 N 关 / 冷却），不在前 30 秒弹。 */
  async showInterstitial(placement, ctx = {}) {
    const rule = SDC.ads?.placements?.[placement];
    if (!SDC.ads?.enabled || !rule || rule.enabled === false) return false;
    if (rule.everyNLevels && (ctx.levelIndex ?? 0) % rule.everyNLevels !== 0) return false;
    if (rule.cooldownMs && Date.now() - state.lastInterstitial < rule.cooldownMs) return false;
    const api = pg();
    if (!api) return false;
    state.lastInterstitial = Date.now();
    emit('adStart');
    try { await api.showInterstitial?.(placement); } catch { /* noop */ }
    emit('adEnd');
    return true;
  },

  onAdStart(fn) { state.listeners.adStart.push(fn); },
  onAdEnd(fn) { state.listeners.adEnd.push(fn); },

  /** 存档：统一命名空间，SDK 不可用时落 localStorage。 */
  save(key, value) {
    const text = JSON.stringify(value);
    try {
      const api = pg();
      if (api?.save) { api.save(key, value); return true; }
    } catch { /* 落到本地 */ }
    rawSet(key, text);
    return true;
  },

  /** 读档：不存在/损坏/类型不符时返回默认值。 */
  load(key, fallback = null) {
    try {
      const api = pg();
      if (api?.load) {
        const v = api.load(key);
        if (v !== undefined && v !== null) return v;
      }
    } catch { /* 落到本地 */ }
    const text = rawGet(key);
    if (text == null) return fallback;
    try { return JSON.parse(text); } catch { return fallback; }
  },

  /** 分享：原生面板 → 复制链接 → 静默失败；每次都打点。 */
  async share(payload = {}) {
    const url = payload.url || (typeof location !== 'undefined' ? location.href : '');
    const text = payload.text || '';
    let channel = 'none';
    try {
      const api = pg();
      if (api?.share) { await api.share({ ...payload, url, text }); channel = 'sdk'; }
      else if (navigator?.share) { await navigator.share({ title: payload.title, text, url }); channel = 'native'; }
      else if (navigator?.clipboard) { await navigator.clipboard.writeText(`${text} ${url}`.trim()); channel = 'copy'; }
    } catch { channel = 'copy'; }
    this.track('share', { channel });
    return channel;
  },
};

export default Sdk;
