/* tools/smoke.cjs — 真玩验收（PC + 触屏各把第 1 关打完）
 *
 *   node tools/smoke.cjs http://127.0.0.1:8000/index.html
 *   node tools/smoke.cjs http://127.0.0.1:8000/index.html --touch
 *   node tools/smoke.cjs http://127.0.0.1:8000/index.html --negative   # 负向自证：停生成必须 FAIL
 *   node tools/smoke.cjs http://127.0.0.1:8000/index.html --live-sdk    # 留真网 SDK 路径
 *
 * 断言：开屏四段顺序（游戏名艺术字 → 大进度条 → 左数字/右平台标识）+ 整屏海报真加载 /
 *       开屏百分比到 100 / HUD 就位 / 渲染 tris 非黑屏 / 目标 ≥1 / 关卡号前进或进度满 /
 *       零 pageerror / 存档写入后可读回 / 广告 SDK 未到位时降级为不发奖。
 * 依赖：puppeteer-core + 本机 Chrome；浏览器在 finally 里必定 close。
 */
"use strict";

const path = require("path");
const puppeteer = require("C:/Users/mcj80/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const args = process.argv.slice(2);
const URL_BASE = args.find((a) => /^https?:\/\//.test(a)) || "http://127.0.0.1:8000/index.html";
const NEGATIVE = args.includes("--negative");
const TOUCH = args.includes("--touch");
const LIVE_SDK = args.includes("--live-sdk");
const ZH = args.includes("--zh");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const errors = [];
function note(page, tag) {
  page.on("pageerror", (e) => errors.push(`[${tag}] pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`[${tag}] console.error: ${m.text()}`);
  });
}

async function stubSdk(page) {
  if (LIVE_SDK) return;
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    // 空 200 而不是 abort：abort 会产生 net::ERR_FAILED，污染「零 console error」断言
    if (req.url().includes("pipysdk.min.js")) {
      req.respond({ status: 200, contentType: "application/javascript", body: "" });
    } else {
      req.continue();
    }
  });
}

async function waitBoot(page) {
  await page.waitForFunction(() => {
    const b = document.getElementById("boot");
    return b && (b.hidden || b.classList.contains("is-done"));
  }, { timeout: 25000 });
  return page.evaluate(() => Number(document.getElementById("boot-pct").textContent));
}

/** 在 DOMContentLoaded 当场抓开屏几何：等到 waitBoot 之后开屏可能已 hidden，量不到。 */
async function captureBootLayout(page) {
  await page.evaluateOnNewDocument(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const pick = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          x: r.left, y: r.top, right: r.right, bottom: r.bottom,
          w: r.width, h: r.height, fs: parseFloat(getComputedStyle(el).fontSize)
        };
      };
      window.__bootLayout = {
        title: pick("#boot-title"), bar: pick(".boot__bar"), row: pick(".boot__row"),
        pct: pick(".boot__pct"), mark: pick(".boot__mark"),
        titleText: (document.getElementById("boot-title") || {}).textContent || "",
        markText: (document.querySelector(".boot__mark") || {}).textContent || "",
        hasCard: !!document.querySelector("[class*='boot__card']"),
        firstPct: (document.getElementById("boot-pct") || {}).textContent || ""
      };
    }, { once: true });
  });
}

function assertBootLayout(bl, wantTitle, tag) {
  if (!bl || !bl.title || !bl.bar || !bl.row || !bl.pct || !bl.mark) {
    throw new Error(`[${tag}] 开屏四段结构不全：${JSON.stringify(bl)}`);
  }
  if (bl.hasCard) throw new Error(`[${tag}] 开屏又套了卡片容器，海报会被切成框里的图`);
  if (bl.title.bottom > bl.bar.top + 2) throw new Error(`[${tag}] 开屏顺序错：游戏名必须在进度条上方`);
  if (bl.bar.bottom > bl.row.top + 2) throw new Error(`[${tag}] 开屏顺序错：进度条必须在底行上方`);
  if (bl.pct.x >= bl.mark.x) throw new Error(`[${tag}] 底行顺序错：进度数字必须在左、平台标识在右`);
  if (Math.abs(bl.pct.y - bl.mark.y) > 44) throw new Error(`[${tag}] 进度数字与平台标识不在同一行`);
  if (bl.title.fs < 34) throw new Error(`[${tag}] 游戏名不是大字艺术字：font-size=${bl.title.fs}`);
  if (bl.bar.h < 24) throw new Error(`[${tag}] 进度条不够大：height=${bl.bar.h}`);
  if (bl.titleText.trim() !== wantTitle) {
    throw new Error(`[${tag}] 开屏游戏名未取 brand.name：「${bl.titleText}」≠「${wantTitle}」`);
  }
  if (!/pipygames\.com/i.test(bl.markText)) {
    throw new Error(`[${tag}] 右侧缺 pipygames.com 标识：「${bl.markText}」`);
  }
}

/** 用真实键盘输入把第 1 关打完：方向键转向 → J 连发；触屏额外补一次真 touch 指针。 */
async function playLevel(page, tag) {
  const started = Date.now();
  const deadline = started + (NEGATIVE ? 11000 : 27000);
  let cleared = false;
  let maxCaught = 0;
  let lastTris = 0;
  let fired = 0;
  let held = null;
  let lastLog = 0;
  // 按「相对视线方位角」转向而不是屏幕像素：屏幕 off 在转身/出屏时会翻转，
  // 方位角与帧率、视口缩放都无关。0.07rad ≈ 4°，落在 78px 命中容差与爆头带内。
  const AIM_ANGLE = 0.07;

  const release = async () => {
    if (held) { await page.keyboard.up(held); held = null; }
  };
  const press = async (key, ms) => {
    if (held !== key) { await release(); await page.keyboard.down(key); held = key; }
    await sleep(ms);
  };

  try {
    while (Date.now() < deadline) {
      const s = await page.evaluate(() => window.PipyGame.debug.snapshot());
      maxCaught = Math.max(maxCaught, s.caught);
      lastTris = Math.max(lastTris, s.renderTris || 0);
      if (s.state === "paused") await page.evaluate(() => window.PipyGame.debug.resume());

      // 过关证据：关卡号前进 / 进度满 / 击杀达标（回调常同步进下一关，抓不到 state=clear）
      if (s.levelIndex > 0 || s.progress >= 1 || s.caught >= s.goal) { cleared = true; break; }

      if (s.ammo <= 1) {
        await release();
        await page.keyboard.press("r");
        await sleep(1600);
        continue;
      }

      if (Date.now() - lastLog > 2000) {
        lastLog = Date.now();
        console.log(`  [${tag}] t=${((Date.now() - started) / 1000).toFixed(1)}s caught=${s.caught} ammo=${s.ammo} ang=${s.items[0] ? s.items[0].ang : "-"} fired=${fired}`);
      }

      const target = s.items[0];
      if (!target) { await release(); await sleep(130); continue; }

      const ang = target.ang;
      if (Math.abs(ang) > AIM_ANGLE) {
        // 目标在视线右侧（ang>0）→ 按右键让 yaw 减小，相机向右转；反之向左
        await press(ang > 0 ? "ArrowRight" : "ArrowLeft",
                    Math.min(180, Math.max(24, Math.round(Math.abs(ang) * 300))));
      } else {
        await release();
        await page.keyboard.down("j");
        await sleep(155);
        await page.keyboard.up("j");
        fired += 1;
      }
      await sleep(24);
    }
  } finally {
    await release();
  }
  return { cleared, maxCaught, lastTris, fired };
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    protocolTimeout: 60000,
    args: [
      "--no-sandbox", "--disable-dev-shm-usage",
      "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader",
      "--autoplay-policy=no-user-gesture-required", "--mute-audio",
      "--disable-background-timer-throttling"
    ]
  });

  try {
    const page = await browser.newPage();
    note(page, TOUCH ? "touch" : "pc");
    if (TOUCH) {
      await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    } else {
      await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    }
    await stubSdk(page);
    await captureBootLayout(page);

    const url = new URL(URL_BASE);
    if (ZH) url.searchParams.set("lang", "zh");
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 30000 });

    const tag = TOUCH ? "touch" : "pc";
    const wantBrand = ZH ? "夜幕爆发" : "NIGHTFALL: OUTBREAK";
    const pct = await waitBoot(page);
    console.log(`[${tag}] boot-pct=${pct}`);
    if (pct < 100) throw new Error(`开屏百分比未到 100：${pct}`);

    // 开屏 UI：四段从上到下、大字艺术字、大进度条、左数字右平台标识，且海报真的铺满整屏
    const bl = await page.evaluate(() => window.__bootLayout);
    assertBootLayout(bl, wantBrand, tag);
    await page.waitForFunction(() => {
      const el = document.getElementById("boot-bg");
      return el && el.classList.contains("is-ready") && el.style.backgroundImage.includes("poster.jpg");
    }, { timeout: 8000 });
    console.log(`[${tag}] boot layout: title ${Math.round(bl.title.fs)}px → bar ${Math.round(bl.bar.h)}px → pct|mark · pct0=${bl.firstPct} · poster ready`);

    // 域名锁：白名单放行 + 外域拦截
    const lock = await page.evaluate(async () => {
      const m = await import("./src/core/domainlock.js");
      return {
        pipy: m.isAllowedHost("pipygames.com"),
        local: m.isAllowedHost("localhost"),
        evil: m.isAllowedHost("evil.example.com")
      };
    });
    if (!lock.pipy || !lock.local || lock.evil) throw new Error(`域名锁放行规则异常：${JSON.stringify(lock)}`);

    // 双语：默认英文；?lang=zh 走平台注入
    const brand = await page.evaluate(() => document.getElementById("menu-title").textContent.trim());
    if (brand !== wantBrand) throw new Error(`默认语言/词条不符：「${brand}」≠「${wantBrand}」`);

    // 区域选择：真图铺在每张关卡卡背后，10 关一关不落
    await page.click("#btn-sectors");
    const grid = await page.evaluate(() => {
      const cards = [...document.querySelectorAll("#levels-grid .sector-card")];
      return {
        open: document.getElementById("ov-levels").classList.contains("is-open"),
        count: cards.length,
        withArt: cards.filter((c) => c.style.backgroundImage.includes("sector-")).length
      };
    });
    if (!grid.open || grid.count !== 10 || grid.withArt !== 10) {
      throw new Error(`区域选择页缩略图不全：${JSON.stringify(grid)}`);
    }
    const artFiles = ["sector-01", "sector-05", "sector-10"];
    const artOk = await page.evaluate((names) => Promise.all(names.map((n) => new Promise((res) => {
      const im = new Image();
      im.onload = () => res({ n, ok: im.naturalWidth > 0 });
      im.onerror = () => res({ n, ok: false });
      im.src = `assets/images/sectors/${n}.webp`;
    }))), artFiles);
    const missingArt = artOk.filter((a) => !a.ok).map((a) => a.n);
    if (missingArt.length) throw new Error(`关卡缩略图解码失败：${missingArt.join(", ")}`);
    console.log(`[${TOUCH ? "touch" : "pc"}] sector cards=${grid.count} art=${grid.withArt}`);
    await page.click("#btn-sectors-back");
    await page.click("#mode-survival");

    // 真实点击主菜单 DEPLOY
    await page.click("#btn-play");
    await page.waitForFunction(() => window.PipyGame && window.PipyGame.debug.snapshot().state === "playing",
                               { timeout: 8000 });

    const hud = await page.evaluate(() => ({
      visible: !document.getElementById("hud").hidden,
      goal: document.getElementById("hud-goal").textContent,
      touch: document.getElementById("touch").classList.contains("is-on"),
      assist: document.getElementById("btn-assist").hidden
    }));
    if (!hud.visible || !hud.goal || hud.assist === true) throw new Error(`HUD 未就位：${JSON.stringify(hud)}`);
    if (TOUCH && !hud.touch) throw new Error("触屏设备未显示触屏控件");

    // 指针锁已移除：对局中光标必须自由，HUD 按钮随时可点
    const locked = await page.evaluate(() => !!document.pointerLockElement);
    if (locked) throw new Error("仍在 pointer lock：ASSIST 等 HUD 按钮将点不到");

    // BGM：AudioContext 已解锁、调度器存活且真的在推进 16 分音符
    await sleep(520);
    const au = await page.evaluate(() => window.PipyGame.debug.audio());
    if (!au.ctx || !au.timer || au.muted || au.step < 2) {
      throw new Error(`激扬 BGM 未启动：${JSON.stringify(au)}`);
    }
    // 主输出实测波形：静音/空调度器的 rms 会是 0，光看 step 会假绿
    const levels = [];
    for (let i = 0; i < 6; i += 1) {
      levels.push((await page.evaluate(() => window.PipyGame.debug.audio())).rms);
      await sleep(90);
    }
    const peak = Math.max(...levels);
    if (peak < 0.001) throw new Error(`BGM 主输出无波形（rms=${peak}）：${JSON.stringify(au)}`);
    console.log(`[${TOUCH ? "touch" : "pc"}] bgm state=${au.state} step=${au.step} rms=${peak} intensity=${au.intensity.toFixed(2)}`);

    // 真正的鼠标点击 ASSIST：点一次必须消耗一次次数（回归 pointer-events / touch-controls 遮挡）
    const assistBefore = await page.evaluate(() => window.PipyGame.debug.assist().left);
    const box = await page.$eval("#btn-assist", (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    });
    if (box.w < 44 || box.h < 44) throw new Error(`ASSIST 点击区过小：${box.w}x${box.h}`);
    await page.mouse.click(box.x, box.y);
    await sleep(180);
    const assistAfter = await page.evaluate(() => window.PipyGame.debug.assist().left);
    if (assistAfter !== assistBefore - 1) {
      throw new Error(`对局中 ASSIST 按钮点不到：${assistBefore} → ${assistAfter}`);
    }
    console.log(`[${TOUCH ? "touch" : "pc"}] ASSIST 真点击 ${assistBefore} → ${assistAfter} · ${Math.round(box.w)}x${Math.round(box.h)}px`);

    // H 快捷键与喇叭开关：键盘兜底 + 静音不误写进「玩法暂停」状态机
    const beforeH = await page.evaluate(() => window.PipyGame.debug.assist().left);
    await page.keyboard.press("h");
    await sleep(150);
    const afterH = await page.evaluate(() => window.PipyGame.debug.assist().left);
    if (afterH !== beforeH - 1) throw new Error(`H 助攻快捷键无效：${beforeH} → ${afterH}`);
    const audioToggle = await page.evaluate(async () => {
      document.getElementById("btn-sound").click();
      await new Promise((r) => setTimeout(r, 180));
      const off = window.PipyGame.debug.audio();
      document.getElementById("btn-sound").click();
      await new Promise((r) => setTimeout(r, 180));
      const on = window.PipyGame.debug.audio();
      return { offMuted: off.muted, onMuted: on.muted, onRms: on.rms };
    });
    if (!audioToggle.offMuted || audioToggle.onMuted || audioToggle.onRms < 0.001) {
      throw new Error(`静音开关往返异常：${JSON.stringify(audioToggle)}`);
    }
    console.log(`[${TOUCH ? "touch" : "pc"}] H 助攻 / 静音往返 OK · 恢复后 rms=${audioToggle.onRms}`);

    // 骨骼走动动画：只看「clip 在播 / time 推进」会假绿（mixer 空转照样推进），
    // 必须同时量到骨骼四元数变化 + 真实位移 + 生成距离够近才看得见步态。
    if (!NEGATIVE) {
      await page.waitForFunction(() => {
        const a = window.PipyGame.debug.anim();
        return a.some((x) => !x.dead && (x.clip === "Walk" || x.clip === "Run") && x.running && x.weight > 0.5);
      }, { timeout: 12000 });
      // 多采样取最大增量：无头触屏只有 5~8fps，单窗口 420ms 可能只推进 2 帧，
      // 固定阈值会假失败；累计 1.2s 后取任意相邻两帧的最大变化才是「真的在动」。
      const frames = [];
      for (let i = 0; i < 5; i += 1) {
        frames.push(await page.evaluate(() => window.PipyGame.debug.anim()));
        await sleep(300);
      }
      let boneMax = 0, timeMax = 0, posTotal = 0, live = 0;
      const delta = (a, b) => {
        for (const x of a) {
          const y = b.find((z) => z.id === x.id);
          if (!y || x.dead || y.dead || !x.bone || !y.bone) continue;
          live += 1;
          boneMax = Math.max(boneMax, Math.hypot(...x.bone.map((v, i) => v - y.bone[i])));
          timeMax = Math.max(timeMax, Math.abs(y.time - x.time));
        }
      };
      for (let k = 0; k < frames.length - 1; k += 1) delta(frames[k], frames[k + 1]);
      // 首末帧同一只怪的累积位移：证明是「持续在走」而不是某一帧抖了一下
      for (const x of frames[0]) {
        const y = frames[frames.length - 1].find((z) => z.id === x.id);
        if (y && !x.dead && !y.dead) posTotal = Math.max(posTotal, Math.hypot(y.x - x.x, y.z - x.z));
      }
      const spawnDist = await page.evaluate(() => {
        const s = window.PipyGame.debug.snapshot();
        return s.items.length ? Math.max(...s.items.map((i) => i.dist)) : 0;
      });
      if (live < 1 || boneMax < 0.008 || posTotal < 0.35 || timeMax < 0.05) {
        throw new Error(`骨骼走动动画未生效：${JSON.stringify({ live, boneMax, posTotal, timeMax })}`);
      }
      if (spawnDist > 21) throw new Error(`敌人生成过远，看不清步态：${spawnDist}m`);
      console.log(`[${tag}] skeleton anim: samples=${live} boneΔ=${boneMax.toFixed(3)} walk=${posTotal.toFixed(2)}m/1.2s timeΔ=${timeMax.toFixed(2)}s · spawn≤${spawnDist}m`);
    }

    // 触屏场景额外补一次真实 touch 指针：按住方向键，yaw 必须真的变化
    if (TOUCH) {
      const before = await page.evaluate(() => window.PipyGame.debug.snapshot().player.yaw);
      const box = await page.$eval("#pad-right", (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      await page.touchscreen.touchStart(box.x, box.y);
      await sleep(220);
      await page.touchscreen.touchEnd();
      const after = await page.evaluate(() => window.PipyGame.debug.snapshot().player.yaw);
      if (Math.abs(after - before) < 0.02) throw new Error(`触屏方向键没有驱动转向：${before} → ${after}`);
      console.log(`[touch] pad-right 真实指针转向 ${before.toFixed(3)} → ${after.toFixed(3)}`);
    }

    const s0 = await page.evaluate(() => window.PipyGame.debug.snapshot());
    if (!LIVE_SDK && s0.adsReady !== false) throw new Error("拦截 SDK 后广告未降级，mock 计数会失真");

    if (NEGATIVE) {
      // 负向自证：把敌人生成停掉，同一套「真玩」流程必须打不通
      await page.evaluate(() => window.PipyGame.debug.setSpawnEnabled(false));
      console.log("[negative] 已停用敌人生成，预期本次 smoke FAIL");
    }

    const r = await playLevel(page, TOUCH ? "touch" : "pc");
    console.log(`[${TOUCH ? "touch" : "pc"}] cleared=${r.cleared} caught=${r.maxCaught} fired=${r.fired} tris=${r.lastTris}`);

    // 负向自证时生成被刻意关掉，「没目标 / 没开火」正是预期的，只保留渲染断言
    if (!NEGATIVE && r.maxCaught < 1) throw new Error("一个目标都没打掉：hitscan / 生成 / 输入至少有一处是坏的");
    if (r.lastTris < 300) throw new Error(`渲染疑似黑屏：triangles=${r.lastTris}`);
    if (!NEGATIVE && r.fired < 1) throw new Error("没有真的开过火（弹药/输入未驱动）");

    // 存档往返
    const save = await page.evaluate(() => {
      window.PipyGame.debug.save();
      const raw = localStorage.getItem("pipy:nightfall-outbreak:v1");
      window.PipyGame.debug.load();
      return raw ? JSON.parse(raw) : null;
    });
    if (!save || typeof save.best !== "number" || typeof save.unlocked !== "number") {
      throw new Error(`存档往返失败：${JSON.stringify(save)}`);
    }

    const expected = !NEGATIVE;
    if (r.cleared !== expected) {
      if (NEGATIVE) throw new Error("负向自证失败：停掉生成后仍然通关，说明 smoke 在假绿");
      throw new Error("第 1 关没打完（进度未满、关卡号未前进）");
    }

    if (errors.length) throw new Error(`存在运行时报错：\n${errors.slice(0, 6).join("\n")}`);

    // 负向模式按约定以非零码退出，供调用方断言"工具确实会 FAIL"
    if (NEGATIVE) {
      console.log("[negative] OK：停掉生成后 smoke 判定为未通关，工具没有假绿");
      process.exitCode = 2;
      return;
    }
    console.log(`PASS ${TOUCH ? "touch" : "pc"} · 第 1 关真玩通关 · 0 error`);
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error("SMOKE FAIL " + (e && e.message));
  if (errors.length) console.error(errors.slice(0, 8).join("\n"));
  process.exitCode = 1;
});
