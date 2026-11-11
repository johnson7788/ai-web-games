/**
 * app.js — 页面外壳：存档、截图、全屏、CRT、攻略面板、ROM 兜底。
 * 模拟器本体由 EmulatorJS（vendor/emulatorjs）提供，这里只做编排。
 */
(function () {
  "use strict";

  var $ = function (sel) { return document.querySelector(sel); };

  var SLOT_COUNT = 3;
  var SLOT_PREFIX = "srw2.slot.";
  var CRT_KEY = "srw2.crt";
  var TITLE = "第2次超级机器人大战";

  var els = {
    boot: $("#boot"),
    bootSub: $("#bootSub"),
    statusText: $("#statusText"),
    statusDot: $("#statusDot"),
    slots: $("#slots"),
    romName: $("#romName"),
    guideDialog: $("#guideDialog"),
    guideList: $("#guideList"),
    guideArticle: $("#guideArticle"),
    romPicker: $("#romPicker"),
    toast: $("#toast")
  };

  var state = {
    running: false,
    guideIndex: null,
    guideCache: Object.create(null),
    currentGuide: null
  };

  /* ------------------------------------------------------------ 小工具 */

  var toastTimer = null;
  function toast(message, bad) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.toggle("bad", !!bad);
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.classList.remove("show");
    }, 2200);
  }

  function setStatus(text, mode) {
    if (els.statusText) els.statusText.textContent = text;
    if (els.statusDot) {
      els.statusDot.classList.remove("live", "wait");
      if (mode) els.statusDot.classList.add(mode);
    }
  }

  function bytesToBase64(bytes) {
    var chunk = 0x8000;
    var parts = [];
    for (var i = 0; i < bytes.length; i += chunk) {
      parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunk)));
    }
    return btoa(parts.join(""));
  }

  function base64ToBytes(base64) {
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function formatTime(ts) {
    var d = new Date(ts);
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function gameManager() {
    var emu = window.EJS_emulator;
    return emu && emu.gameManager ? emu.gameManager : null;
  }

  /* ------------------------------------------------------------ 存档槽 */

  function readSlot(index) {
    try {
      var raw = localStorage.getItem(SLOT_PREFIX + index);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && parsed.data ? parsed : null;
    } catch (err) {
      return null;
    }
  }

  function renderSlots() {
    if (!els.slots) return;
    els.slots.innerHTML = "";

    for (var i = 1; i <= SLOT_COUNT; i++) {
      (function (index) {
        var saved = readSlot(index);
        var row = document.createElement("div");
        row.className = "slot" + (saved ? " filled" : "");

        var name = document.createElement("span");
        name.className = "slot-name";
        name.textContent = "SLOT " + String(index).padStart(2, "0");

        var meta = document.createElement("span");
        meta.className = "slot-meta";
        meta.textContent = saved
          ? formatTime(saved.at) + " · " + Math.round((saved.size || 0) / 1024) + " KB"
          : "空档位";

        var actions = document.createElement("div");
        actions.className = "slot-actions";

        var saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.textContent = "存";
        saveBtn.title = "保存到档位 " + index;
        saveBtn.addEventListener("click", function () { saveSlot(index); });

        var loadBtn = document.createElement("button");
        loadBtn.type = "button";
        loadBtn.textContent = "读";
        loadBtn.title = "读取档位 " + index;
        loadBtn.disabled = !saved;
        loadBtn.addEventListener("click", function () { loadSlot(index); });

        actions.appendChild(saveBtn);
        actions.appendChild(loadBtn);

        row.appendChild(name);
        row.appendChild(meta);
        row.appendChild(actions);
        els.slots.appendChild(row);
      })(i);
    }
  }

  function saveSlot(index) {
    var gm = gameManager();
    if (!gm) {
      toast("模拟器还没启动，先点画面里的「开始战斗」", true);
      return;
    }

    var bytes;
    try {
      bytes = gm.getState();
    } catch (err) {
      toast("当前核心不支持即时存档", true);
      return;
    }

    try {
      localStorage.setItem(SLOT_PREFIX + index, JSON.stringify({
        v: 1,
        at: Date.now(),
        size: bytes.length,
        data: bytesToBase64(bytes)
      }));
    } catch (err) {
      toast("浏览器存储空间不足，存档失败", true);
      return;
    }

    renderSlots();
    toast("已存入 SLOT " + String(index).padStart(2, "0"));
  }

  function loadSlot(index) {
    var gm = gameManager();
    if (!gm) {
      toast("模拟器还没启动", true);
      return;
    }
    var saved = readSlot(index);
    if (!saved) {
      toast("这个档位还是空的", true);
      return;
    }

    try {
      gm.loadState(base64ToBytes(saved.data));
      toast("已读取 SLOT " + String(index).padStart(2, "0"));
    } catch (err) {
      toast("读档失败：ROM 版本可能不同", true);
    }
  }

  /* -------------------------------------------------------- 模拟器事件 */

  window.EJS_ready = function () {
    setStatus("就绪 · 等待点火", "wait");
    if (els.bootSub) els.bootSub.textContent = "运行时已就绪，点击画面中央开始";
  };

  window.EJS_onGameStart = function () {
    state.running = true;
    setStatus("运行中", "live");
    if (els.boot) els.boot.classList.add("hidden");
    var attract = document.getElementById("attract");
    if (attract) attract.classList.add("hidden");
    if (window.SRW_ROM_NAME && els.romName) {
      els.romName.textContent = "ROM · " + window.SRW_ROM_NAME;
    }
    ["#btnPause", "#btnRestart"].forEach(function (sel) {
      var btn = $(sel);
      if (btn) btn.disabled = false;
    });
    renderSlots();
  };

  function showRomMissing() {
    setStatus("等待 ROM", "wait");
    if (!els.boot) return;
    els.boot.classList.remove("hidden");
    els.boot.innerHTML =
      '<p class="boot-kicker">INSERT CARTRIDGE</p>' +
      '<p class="boot-title">把 .nes 拖进来</p>' +
      '<p class="boot-sub">这个页面不带游戏本体。用你自己卡带转储的 ROM 开局，<br>文件只在本地浏览器里运行，不会上传。</p>' +
      '<div class="boot-actions"><button class="btn primary" type="button" id="bootPick">选择 ROM 文件</button></div>' +
      '<p class="boot-note">支持 iNES / mapper 74 · 仅限个人使用</p>';
    var pick = document.getElementById("bootPick");
    if (pick) pick.addEventListener("click", function () { els.romPicker.click(); });
  }

  window.addEventListener("srw:rom-missing", showRomMissing);

  window.addEventListener("srw:error", function (event) {
    setStatus("运行时报错", "wait");
    toast(event.detail || "运行时加载失败", true);
  });

  /* ------------------------------------------------------------ 顶部按钮 */

  var pauseBtn = $("#btnPause");
  if (pauseBtn) {
    pauseBtn.addEventListener("click", function () {
      var emu = window.EJS_emulator;
      if (!emu || !state.running) return;
      try {
        if (emu.paused) {
          emu.play();
          pauseBtn.textContent = "暂停";
          setStatus("运行中", "live");
        } else {
          emu.pause();
          pauseBtn.textContent = "继续";
          setStatus("已暂停", "wait");
        }
      } catch (err) {
        toast("暂停失败", true);
      }
    });
  }

  var restartBtn = $("#btnRestart");
  if (restartBtn) {
    restartBtn.addEventListener("click", function () {
      var gm = gameManager();
      if (!gm || !state.running) return;
      if (!window.confirm("重开游戏？未存档的进度会丢失。")) return;
      try {
        gm.restart();
        pauseBtn.textContent = "暂停";
        setStatus("运行中", "live");
        toast("已重开");
      } catch (err) {
        toast("重开失败", true);
      }
    });
  }

  var muteBtn = $("#btnMute");
  if (muteBtn) {
    muteBtn.addEventListener("click", function () {
      var emu = window.EJS_emulator;
      if (!emu) return;
      try {
        emu.muted = !emu.muted;
        emu.setVolume(emu.muted ? 0 : emu.volume);
        muteBtn.setAttribute("aria-pressed", String(emu.muted));
        muteBtn.textContent = emu.muted ? "取消静音" : "静音";
      } catch (err) {
        toast("音频控制失败", true);
      }
    });
  }

  var crtBtn = $("#btnCrt");
  if (crtBtn) {
    var stored = localStorage.getItem(CRT_KEY);
    if (stored === "off") document.body.classList.add("no-crt");
    crtBtn.setAttribute("aria-pressed", document.body.classList.contains("no-crt") ? "false" : "true");
    crtBtn.addEventListener("click", function () {
      var off = document.body.classList.toggle("no-crt");
      localStorage.setItem(CRT_KEY, off ? "off" : "on");
      crtBtn.setAttribute("aria-pressed", off ? "false" : "true");
      toast(off ? "CRT 滤镜：关闭" : "CRT 滤镜：开启");
    });
  }

  var shotBtn = $("#btnShot");
  if (shotBtn) {
    shotBtn.addEventListener("click", async function () {
      var gm = gameManager();
      if (!gm || !state.running) {
        toast("先进游戏再截图", true);
        return;
      }
      try {
        var png = await gm.screenshot();
        var blob = new Blob([png], { type: "image/png" });
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = "srw2-" + Date.now() + ".png";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        toast("截图已保存");
      } catch (err) {
        toast("截图失败", true);
      }
    });
  }

  var fullBtn = $("#btnFull");
  if (fullBtn) {
    fullBtn.addEventListener("click", function () {
      var target = document.querySelector(".bezel");
      if (!target) return;
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (target.requestFullscreen) {
        target.requestFullscreen().catch(function () { toast("浏览器拒绝了全屏", true); });
      }
    });
    document.addEventListener("fullscreenchange", function () {
      fullBtn.textContent = document.fullscreenElement ? "退出全屏" : "全屏";
    });
  }

  var importBtn = $("#btnImport");
  if (importBtn) {
    importBtn.addEventListener("click", function () {
      if (state.running) {
        toast("已在使用 ROM；换 ROM 请刷新页面后重新选择", true);
        return;
      }
      els.romPicker.click();
    });
  }

  function startWithFile(file) {
    if (!file) return;
    var url = URL.createObjectURL(file);
    if (els.boot) els.boot.classList.add("hidden");
    setStatus("加载自定义 ROM", "wait");
    window.SRWStartEmulator(url, file.name);
  }

  if (els.romPicker) {
    els.romPicker.addEventListener("change", function () {
      startWithFile(els.romPicker.files && els.romPicker.files[0]);
      els.romPicker.value = "";
    });
  }

  // 拖拽 ROM 到画面里也能开局
  var dropZone = document.querySelector(".screen") || document.body;
  var dragDepth = 0;
  ["dragenter", "dragover"].forEach(function (type) {
    dropZone.addEventListener(type, function (event) {
      if (!event.dataTransfer || !Array.from(event.dataTransfer.types).includes("Files")) return;
      event.preventDefault();
      if (type === "dragenter") dragDepth++;
      dropZone.classList.add("dragover");
    });
  });
  dropZone.addEventListener("dragleave", function () {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dropZone.classList.remove("dragover");
  });
  dropZone.addEventListener("drop", function (event) {
    if (!event.dataTransfer) return;
    event.preventDefault();
    dragDepth = 0;
    dropZone.classList.remove("dragover");
    var file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (!file) return;
    if (!/\.(nes|NES|zip|ZIP)$/.test(file.name)) {
      toast("请拖入 .nes 文件", true);
      return;
    }
    if (state.running) {
      toast("已经载入 ROM 了，换 ROM 请刷新页面", true);
      return;
    }
    startWithFile(file);
  });

  /* ------------------------------------------------------------ 攻略面板 */

  var CATEGORY_ORDER = ["入门", "流程攻略", "数据资料", "杂谈"];

  async function loadGuideIndex() {
    if (state.guideIndex) return state.guideIndex;
    var res = await fetch("data/guides/index.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("攻略索引读取失败");
    state.guideIndex = await res.json();
    return state.guideIndex;
  }

  function renderGuideList(index) {
    els.guideList.innerHTML = "";
    var groups = {};
    index.forEach(function (item) {
      (groups[item.cat] = groups[item.cat] || []).push(item);
    });

    var cats = Object.keys(groups).sort(function (a, b) {
      return CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b);
    });

    cats.forEach(function (cat) {
      var label = document.createElement("p");
      label.className = "guide-cat";
      label.textContent = cat;
      els.guideList.appendChild(label);

      groups[cat].forEach(function (item) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "guide-item";
        btn.textContent = item.title;
        btn.addEventListener("click", function () { openGuide(item, btn); });
        els.guideList.appendChild(btn);
      });
    });
  }

  async function fetchGuide(item) {
    if (state.guideCache[item.file]) return state.guideCache[item.file];
    var res = await fetch("data/guides/" + encodeURIComponent(item.file), { cache: "force-cache" });
    if (!res.ok) throw new Error("读取失败");
    var buffer = await res.arrayBuffer();
    var text;
    try {
      text = new TextDecoder("gb18030").decode(buffer);
    } catch (err) {
      text = new TextDecoder("utf-8").decode(buffer);
    }
    state.guideCache[item.file] = text.replace(/\r\n/g, "\n");
    return state.guideCache[item.file];
  }

  async function openGuide(item, button) {
    state.currentGuide = item.file;
    els.guideList.querySelectorAll(".guide-item").forEach(function (node) {
      node.setAttribute("aria-current", node === button ? "true" : "false");
    });

    els.guideArticle.innerHTML = '<p class="placeholder">读取中…</p>';
    try {
      var text = await fetchGuide(item);
      var blocks = text.split(/\n+/).map(function (line) { return line.trim(); }).filter(Boolean);
      var html = '<h3></h3><p class="meta"></p>';
      els.guideArticle.innerHTML = html;
      els.guideArticle.querySelector("h3").textContent = item.title;
      els.guideArticle.querySelector(".meta").textContent =
        item.cat + " · " + blocks.length + " 段 · 约 " + text.length + " 字";

      var frag = document.createDocumentFragment();
      blocks.forEach(function (line) {
        var p = document.createElement("p");
        p.textContent = line;
        frag.appendChild(p);
      });
      els.guideArticle.appendChild(frag);
      els.guideArticle.scrollTop = 0;
    } catch (err) {
      els.guideArticle.innerHTML = '<p class="placeholder">这篇读不出来，换一篇试试。</p>';
    }
  }

  var guideBtn = $("#btnGuide");
  if (guideBtn && els.guideDialog) {
    guideBtn.addEventListener("click", async function () {
      if (!els.guideDialog.open) els.guideDialog.showModal();
      try {
        var index = await loadGuideIndex();
        if (!els.guideList.childElementCount) {
          renderGuideList(index);
          if (index[0]) {
            var first = els.guideList.querySelector(".guide-item");
            openGuide(index[0], first);
          }
        }
      } catch (err) {
        els.guideList.innerHTML = '<p class="placeholder">攻略索引没加载出来。</p>';
      }
    });
  }

  var guideClose = $("#guideClose");
  if (guideClose && els.guideDialog) {
    guideClose.addEventListener("click", function () { els.guideDialog.close(); });
  }

  /* -------------------------------------------------------------- 启动 */

  renderSlots();
  if (window.SRW_ROM_MISSING) {
    showRomMissing();
  } else {
    setStatus("正在点火…", "wait");
  }
})();
