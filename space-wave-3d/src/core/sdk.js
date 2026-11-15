// src/core/sdk.js — 门户 SDK 唯一出口（域名锁/广告/埋点/存档/分享统一走这里）。
// 依赖 config/sdk.config.js；SDK 加载失败/断网一律降级为本地 mock，所有方法安全返回。
import { SDC } from '../../config/sdk.config.js';

const state = {
  loading: null,
  ready: false,
  used: new Map(),
  lastInterstitial: 0,
  listeners: { adStart: [], adEnd: [] },
};

function pg() { return typeof window !== 'undefined' ? window.PipyGames || null : null; }
function storageKey(key) { return `${SDC.save.keyPrefix}:${key}`; }

function rawGet(key) { try { return window.localStorage.getItem(storageKey(key)); } catch { return null; } }
function rawSet(key, value) { try { window.localStorage.setItem(storageKey(key), value); } catch { /* 隐私模式 */ } }

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
    const finish = (v) => { if (settled) return; settled = true; clearTimeout(timer); resolve(v); };
    const timer = setTimeout(() => finish(pg()), SDC.loadTimeoutMs);
    script.onload = () => finish(pg());
    script.onerror = () => finish(null);
    document.head.appendChild(script);
  });
  return state.loading;
}

function emit(kind) { for (const fn of state.listeners[kind]) { try { fn(); } catch { /* noop */ } } }

export const Sdk = {
  get available() { return !!pg(); },

  async ready() {
    await injectSdk();
    const api = pg();
    if (!api) return null;
    try { await Promise.race([api.ready, new Promise((r) => setTimeout(r, SDC.loadTimeoutMs))]); state.ready = true; }
    catch { /* 降级 */ }
    return api;
  },

  track(name, payload = {}) {
    if (SDC.tracking && SDC.tracking.enabled === false) return;
    try { pg()?.track?.(name, payload); } catch { /* 埋点失败不影响玩法 */ }
  },

  newRun(payload = {}) {
    state.used.clear();
    try { pg()?.newRun?.(payload); } catch { /* noop */ }
    this.track('start', payload);
  },

  levelCleared(payload = {}) { try { pg()?.levelCleared?.(payload); } catch { /* noop */ } this.track('win', payload); },
  gameOver(payload = {}) { try { pg()?.gameOver?.(payload); } catch { /* noop */ } this.track('fail', payload); },

  canShowAd(placement) {
    if (!SDC.ads || SDC.ads.enabled !== true) return false;
    const rule = SDC.ads.placements?.[placement];
    if (!rule) return false;
    if (rule.maxPerRun != null && (state.used.get(placement) ?? 0) >= rule.maxPerRun) return false;
    const api = pg();
    if (!api) return false;
    try { return api.canShowAd?.(placement) !== false; } catch { return false; }
  },

  async showRewarded(placement, ctx = {}) {
    if (!this.canShowAd(placement)) return false;
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

  async showInterstitial(placement, ctx = {}) {
    if (!SDC.ads?.enabled) return false;
    const rule = SDC.ads?.placements?.[placement];
    if (!rule || rule.enabled === false) return false;
    const api = pg();
    if (!api) return false;
    state.lastInterstitial = Date.now();
    emit('adStart');
    try { await api.showInterstitial?.(placement, ctx); } catch { /* noop */ }
    emit('adEnd');
    return true;
  },

  onAdStart(fn) { state.listeners.adStart.push(fn); },
  onAdEnd(fn) { state.listeners.adEnd.push(fn); },

  save(key, value) {
    const text = JSON.stringify(value);
    try { const api = pg(); if (api?.save) { api.save(key, value); return true; } } catch { /* 落到本地 */ }
    rawSet(key, text);
    return true;
  },

  load(key, fallback = null) {
    try {
      const api = pg();
      if (api?.load) { const v = api.load(key); if (v !== undefined && v !== null) return v; }
    } catch { /* 落到本地 */ }
    const text = rawGet(key);
    if (text == null) return fallback;
    try { return JSON.parse(text); } catch { return fallback; }
  },

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
