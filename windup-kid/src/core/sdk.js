// 门户 SDK 统一出口：有 PipyGames 就用，没有就走本地 mock（离线可玩、可测频控）
const QS = new URLSearchParams(location.search);
const FORCE_LOCAL = QS.has('local-sdk');
const isLocalHost = ['localhost', '127.0.0.1', '::1', ''].includes(location.hostname);

const ADS_RULES = {
  revive: { maxPerRun: 1, minLevelIndex: 1 },
  doubleCoins: { maxPerRun: 1, minLevelIndex: 0 },
  stageClear: { everyNLevels: 3, cooldownMs: 45000, minLevelIndex: 2 },
  gameOver: { enabled: false },
};

const state = {
  runId: 0,
  used: new Map(),        // placement → 本局次数
  lastInterstitial: 0,
  showing: false,
  events: [],
};

function pg() { return typeof window !== 'undefined' ? window.PipyGames : null; }

export const Sdk = {
  get available() { return !!pg(); },

  async ready() {
    const api = pg();
    if (!api) return null;
    try { await api.ready; } catch { /* 忽略 */ }
    return api;
  },

  newRun(levelIndex) {
    state.runId++;
    state.used.clear();
    state.levelIndex = levelIndex;
    const api = pg();
    api?.newRun?.();
    this.track('start', { level: levelIndex + 1 });
  },

  canShow(placement, ctx = {}) {
    const rule = ADS_RULES[placement];
    if (!rule || rule.enabled === false) return false;
    const levelIndex = ctx.levelIndex ?? state.levelIndex ?? 0;
    if (levelIndex < (rule.minLevelIndex ?? 0)) return false;
    const used = state.used.get(placement) ?? 0;
    if (rule.maxPerRun && used >= rule.maxPerRun) return false;
    if (placement === 'stageClear') {
      if ((levelIndex + 1) % rule.everyNLevels !== 0) return false;
      if (Date.now() - state.lastInterstitial < rule.cooldownMs) return false;
    }
    if (placement === 'revive' && ctx.cause === 'pit') return false;
    return true;
  },

  async showRewarded(placement, ctx = {}) {
    if (!this.canShow(placement, ctx)) return false;
    state.used.set(placement, (state.used.get(placement) ?? 0) + 1);

    const api = pg();
    let ok = false;
    if (api) {
      try { ok = await api.showRewarded(placement); } catch { ok = false; }
    } else {
      ok = await mockAd(1200);
    }
    this.track('ad_show', { placement, ok });
    this.track('revive', { ok });
    return ok;
  },

  async showInterstitial(placement, ctx = {}) {
    if (!this.canShow(placement, ctx)) return false;
    state.lastInterstitial = Date.now();
    const api = pg();
    if (api) { try { await api.showInterstitial(placement); } catch { /* noop */ } }
    else await mockAd(900);
    this.track('ad_show', { placement, ok: true });
    return true;
  },

  levelCleared(payload) {
    const api = pg();
    api?.levelCleared?.(payload);
    this.track('level_clear', payload);
  },

  track(name, data = {}) {
    const entry = { name, data, t: Date.now() };
    state.events.push(entry);
    if (state.events.length > 200) state.events.shift();
    const api = pg();
    if (api) { try { api.track?.(name, data); } catch { /* noop */ } }
    try {
      const key = 'windupkid_events';
      const prev = JSON.parse(localStorage.getItem(key) || '[]');
      prev.push(entry);
      localStorage.setItem(key, JSON.stringify(prev.slice(-100)));
    } catch { /* 隐私模式 */ }
    if (QS.has('debug')) console.debug('[track]', name, data);
  },

  get log() { return state.events; },
};

function mockAd(ms) {
  const mask = document.getElementById('adMask');
  mask?.classList.remove('hidden');
  return new Promise((resolve) => {
    setTimeout(() => {
      mask?.classList.add('hidden');
      resolve(true);
    }, ms);
  });
}

/** 非本地环境自动注入线上 SDK（本地不加载，避免离线 404） */
export function injectSdk() {
  if (isLocalHost || FORCE_LOCAL) return Promise.resolve(null);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://pipygames.com/sdk/pipysdk.min.js';
    s.dataset.appId = 'windup-kid';
    s.onload = () => resolve(window.PipyGames ?? null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}
