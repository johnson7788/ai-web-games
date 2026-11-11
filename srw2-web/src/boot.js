/**
 * boot.js — 先把 ROM 找出来，再把 EmulatorJS 运行时接上去。
 *
 * 默认从 rom/srw2.nes 读取；如果仓库里没有这个文件（比如公开分发时
 * 不想带 ROM），就抛一个 srw:rom-missing 事件，由 app.js 提示用户
 * 自己选一个 .nes 文件。也可以用 ?rom=<url> 指定任意地址。
 */
(function () {
  "use strict";

  var DEFAULT_ROM = "rom/srw2.nes";
  var DATA_PATH = "vendor/emulatorjs/data/";
  var params = new URLSearchParams(window.location.search);
  var started = false;

  function startEmulator(url, name) {
    if (started) return false;
    started = true;

    window.EJS_player = "#game";
    window.EJS_core = "nes";
    window.EJS_gameUrl = url;
    window.EJS_gameName = name || "第2次超级机器人大战";
    window.EJS_pathtodata = DATA_PATH;
    window.EJS_language = "zh-CN";
    window.EJS_startOnLoaded = false;
    window.EJS_startButtonName = "开 始 战 斗";
    window.EJS_volume = 0.65;
    window.EJS_backgroundColor = "#000000";
    window.EJS_CacheLimit = 1024;
    // 只留下真正需要的按钮，其余交给页面自己的工具条
    window.EJS_Buttons = {
      playPause: true,
      restart: true,
      settings: false,
      saveState: false,
      loadState: false,
      screenshot: false,
      screenRecord: false,
      quickSave: false,
      quickLoad: false,
      cheat: false,
      cacheManager: false,
      saveSavFiles: false,
      loadSavFiles: false,
      netplay: false,
      gamepad: true,
      mute: true,
      volume: true,
      fullscreen: false
    };
    window.SRW_ROM_NAME = name || "自定义 ROM";

    var script = document.createElement("script");
    script.src = DATA_PATH + "loader.js";
    script.async = false;
    script.onerror = function () {
      window.dispatchEvent(new CustomEvent("srw:error", { detail: "运行时加载失败" }));
    };
    document.body.appendChild(script);
    return true;
  }

  window.SRWStartEmulator = startEmulator;

  // 探测 ROM 是否存在，存在就直接开机
  (async function boot() {
    var url = params.get("rom");
    var name = "自定义 ROM";

    if (!url) {
      try {
        var res = await fetch(DEFAULT_ROM, { method: "HEAD", cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        url = DEFAULT_ROM;
        name = "第2次超级机器人大战";
      } catch (err) {
        // 先记状态，再等一个宏任务后再广播：app.js 可能还没绑定监听器
        window.SRW_ROM_MISSING = true;
        setTimeout(function () {
          window.dispatchEvent(new CustomEvent("srw:rom-missing"));
        }, 0);
        return;
      }
    } else {
      name = url.split("/").pop() || "自定义 ROM";
    }

    startEmulator(url, name);
  })();
})();
