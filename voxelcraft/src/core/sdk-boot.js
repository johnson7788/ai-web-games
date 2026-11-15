// src/core/sdk-boot.js — 门户 SDK 唯一出口（classic 版，零依赖，适配开源模板改造批）
// 职责：加载 pipysdk（本地 vendored 或线上）、就绪等待、广告/埋点/存档/分享，全部带降级。
// 依赖：config/sdk.config.js（唯一配置源，window.SDK_CONFIG）。
// 业务侧只允许经 window.PipySDK 碰 SDK；禁止零散广告调用 / 埋点 fetch / 直写 localStorage。
// 降级：脚本超时、域名被拦、SDK 未注入 → available=false，所有方法安全失败（返回 false/默认值）。
(function () {
  'use strict';
  var SDC = window.SDK_CONFIG || {};
  if (!SDC.appId) SDC.appId = 'pipy-unknown';
  if (!SDC.loadTimeoutMs) SDC.loadTimeoutMs = 3000;
  if (!SDC.ads) SDC.ads = { enabled: false };
  if (!SDC.tracking) SDC.tracking = { enabled: true };
  if (!SDC.save) SDC.save = { keyPrefix: SDC.appId };

  var state = {
    loading: null,
    ready: false,
    used: {},            // placement -> 本局已用次数
    lastInterstitial: 0,
    listeners: { adStart: [], adEnd: [] },
  };

  function pg() { return window.PipyGames || null; }
  function storageKey(key) { return SDC.save.keyPrefix + ':' + key; }
  function rawGet(key) { try { return window.localStorage.getItem(storageKey(key)); } catch (e) { return null; } }
  function rawSet(key, value) { try { window.localStorage.setItem(storageKey(key), value); } catch (e) { /* 隐私模式 */ } }

  /** 注入 pipysdk 脚本；已存在则直通。超时或失败返回 null。 */
  function injectSdk() {
    if (pg()) return Promise.resolve(pg());
    if (state.loading) return state.loading;
    state.loading = new Promise(function (resolve) {
      var existing = document.querySelector('script[data-pipysdk]');
      var script;
      if (existing) {
        script = existing;
      } else {
        script = document.createElement('script');
        script.src = SDC.source === 'online' ? (SDC.sdkUrl || 'https://pipygames.com/sdk/pipysdk.min.js') : (SDC.localUrl || './src/vendor/pipysdk.js');
        script.dataset.appId = SDC.appId;
        script.dataset.pipysdk = '1';
        script.defer = true;
        document.head.appendChild(script);
      }
      var settled = false;
      function finish(value) { if (settled) return; settled = true; clearTimeout(timer); resolve(value); }
      var timer = setTimeout(function () { finish(pg()); }, SDC.loadTimeoutMs);
      script.addEventListener('load', function () { finish(pg()); });
      script.addEventListener('error', function () { finish(null); });
    });
    return state.loading;
  }

  function emit(kind) {
    (state.listeners[kind] || []).forEach(function (fn) { try { fn(); } catch (e) { /* 监听器异常不影响游戏 */ } });
  }

  var API = {
    /** SDK 是否真的可用（false = 本地降级模式） */
    get available() { return !!pg(); },

    /** 等待 SDK 就绪；永不挂起（loadTimeoutMs 兜底）。 */
    ready: function () {
      return injectSdk().then(function () {
        var api = pg();
        if (!api) return null;
        return Promise.race([
          Promise.resolve(api.ready),
          new Promise(function (r) { setTimeout(r, SDC.loadTimeoutMs); }),
        ]).then(function () { state.ready = true; return api; }).catch(function () { return api; });
      });
    },

    /** 自定义埋点；SDK 不可用时不抛错。 */
    track: function (name, payload) {
      if (SDC.tracking && SDC.tracking.enabled === false) return;
      try { var api = pg(); if (api && api.track) api.track(name, payload || {}); } catch (e) { /* 埋点失败不影响玩法 */ }
    },

    /** 开局：清空按局频控 + track('start')。 */
    newRun: function (payload) {
      state.used = {};
      try { var api = pg(); if (api && api.newRun) api.newRun(payload || {}); } catch (e) { /* noop */ }
      this.track('start', payload || {});
    },

    /** 过关：track('win')。 */
    levelCleared: function (payload) {
      try { var api = pg(); if (api && api.levelCleared) api.levelCleared(payload || {}); } catch (e) { /* noop */ }
      this.track('win', payload || {});
    },

    /** 失败：track('fail')。 */
    gameOver: function (payload) {
      try { var api = pg(); if (api && api.gameOver) api.gameOver(payload || {}); } catch (e) { /* noop */ }
      this.track('fail', payload || {});
    },

    /** 广告是否可用（配置关闭时恒为 false）。 */
    canShowAd: function (placement, ctx) {
      if (!SDC.ads || SDC.ads.enabled !== true) return false;
      var rule = (SDC.ads.placements || {})[placement];
      if (!rule) return false;
      if (rule.maxPerRun != null && (state.used[placement] || 0) >= rule.maxPerRun) return false;
      var api = pg();
      if (!api) return false;
      try { return api.canShowAd ? api.canShowAd(placement, ctx || {}) !== false : false; } catch (e) { return false; }
    },

    /** 激励视频：true 才发奖；任何失败路径都返回 false。 */
    showRewarded: function (placement, ctx) {
      if (!this.canShowAd(placement, ctx)) return Promise.resolve(false);
      var api = pg();
      if (!api) return Promise.resolve(false);
      state.used[placement] = (state.used[placement] || 0) + 1;
      emit('adStart');
      var self = this;
      var p;
      try { p = Promise.resolve(api.showRewarded ? api.showRewarded(placement, ctx || {}) : false); } catch (e) { p = Promise.resolve(false); }
      return Promise.race([
        p,
        new Promise(function (r) { setTimeout(function () { r(false); }, SDC.ads.fillTimeoutMs || 9000); }),
      ]).then(function (ok) {
        emit('adEnd');
        self.track('ad_show', { placement: placement, ok: ok === true });
        return ok === true;
      }).catch(function () { emit('adEnd'); return false; });
    },

    onAdStart: function (fn) { state.listeners.adStart.push(fn); },
    onAdEnd: function (fn) { state.listeners.adEnd.push(fn); },

    /** 存档：统一命名空间，SDK 不可用时落 localStorage。 */
    save: function (key, value) {
      var text = JSON.stringify(value);
      try { var api = pg(); if (api && api.save) { api.save(key, value); return true; } } catch (e) { /* 落到本地 */ }
      rawSet(key, text);
      return true;
    },

    /** 读档：不存在/损坏/类型不符时返回默认值。 */
    load: function (key, fallback) {
      if (fallback === undefined) fallback = null;
      try {
        var api = pg();
        if (api && api.load) {
          var v = api.load(key);
          if (v !== undefined && v !== null) return v;
        }
      } catch (e) { /* 落到本地 */ }
      var text = rawGet(key);
      if (text == null) return fallback;
      try { return JSON.parse(text); } catch (e) { return fallback; }
    },

    /** 分享：原生面板 → 复制链接 → 静默失败；每次都打点。 */
    share: function (payload) {
      payload = payload || {};
      var url = payload.url || (typeof location !== 'undefined' ? location.href : '');
      var text = payload.text || '';
      var channel = 'none';
      var api = pg();
      var p = Promise.resolve();
      if (api && api.share) { p = Promise.resolve(api.share({ url: url, text: text, title: payload.title })).then(function () { channel = 'sdk'; }); }
      else if (navigator.share) { p = navigator.share({ title: payload.title, text: text, url: url }).then(function () { channel = 'native'; }); }
      else if (navigator.clipboard) { p = navigator.clipboard.writeText((text + ' ' + url).trim()).then(function () { channel = 'copy'; }); }
      var self = this;
      return p.catch(function () { channel = 'copy'; }).then(function () { self.track('share', { channel: channel }); return channel; });
    },
  };

  window.PipySDK = API;
  // 自动就绪 + 首屏埋点（失败不阻塞玩法）
  API.ready().then(function () { API.track('load', { appId: SDC.appId }); });
})();