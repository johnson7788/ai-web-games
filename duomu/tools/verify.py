#!/usr/bin/env python3
"""《夺木》验收：真鼠标点击 + 真键盘打通一局，并覆盖语言、暂停、存档、移动端。

产出 tests/artifacts/verify-report.json，任何一项红就退出码 1。
"""
import functools
import http.server
import json
import os
import socket
import socketserver
import sys
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tests/artifacts")


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve(port):
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", port), functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


class Checker:
    def __init__(self):
        self.items = []

    def add(self, name, ok, detail=""):
        self.items.append({"name": name, "ok": bool(ok), "detail": str(detail)[:400]})
        print(("  PASS  " if ok else "  FAIL  ") + name + (("  — " + str(detail)[:160]) if detail else ""))
        return ok


def main():
    os.makedirs(OUT, exist_ok=True)
    port = free_port()
    serve(port)
    url = f"http://127.0.0.1:{port}/index.html"

    from playwright.sync_api import sync_playwright

    ck = Checker()
    console, pageerrors, failed = [], [], []
    result = {"url": url, "checks": ck.items, "console": console, "pageerrors": pageerrors,
              "requestFailed": failed}

    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"])
        ctx = browser.new_context(viewport={"width": 720, "height": 1280}, device_scale_factor=2)
        page = ctx.new_page()
        page.on("console", lambda m: console.append({"type": m.type, "text": m.text}))
        page.on("pageerror", lambda e: pageerrors.append(str(e)))
        page.on("requestfailed", lambda r: failed.append({"url": r.url, "err": r.failure}))

        page.goto(url, wait_until="networkidle")
        page.wait_for_function("window.__game && window.__game.screen !== 'loading'", timeout=25000)
        # 保证从「干净存档」开始，否则上一轮的语言/最高分会串场
        page.evaluate("localStorage.clear()")
        page.reload(wait_until="networkidle")
        page.wait_for_function("window.__game && window.__game.screen !== 'loading'", timeout=25000)
        time.sleep(0.4)

        box = page.locator("#game").bounding_box()

        def click_world(wx, wy):
            """按 720×1280 逻辑坐标点击画布"""
            page.mouse.click(box["x"] + wx / 720 * box["width"], box["y"] + wy / 1280 * box["height"])

        def state():
            return page.evaluate("window.__ll.state")

        # ── 1. 主菜单 + 默认英文 ──
        ck.add("主菜单已渲染", state()["screen"] == "menu")
        ck.add("默认语言是英文", page.evaluate("window.__game.lang") == "en")
        ck.add("html lang = en", page.evaluate("document.documentElement.lang") == "en")
        # 中文可用：?lang=zh 生效并记忆
        page.goto(url + "?lang=zh", wait_until="networkidle")
        page.wait_for_function("window.__game && window.__game.screen !== 'loading'", timeout=25000)
        time.sleep(0.4)
        ck.add("?lang=zh 切到中文", page.evaluate("window.__game.lang") == "zh")
        ck.add("html lang = zh-CN", page.evaluate("document.documentElement.lang") == "zh-CN")
        page.evaluate("window.__ll.lang('en')")
        time.sleep(0.2)
        ck.add("可切回英文", page.evaluate("window.__game.lang") == "en")
        ck.add("无 404 / 请求失败", not failed, failed)
        ck.add("无 JS 异常", not pageerrors, pageerrors)

        # ── 2. 玩法说明：键盘打开/关闭 ──
        page.keyboard.press("Escape")
        time.sleep(0.2)
        ck.add("Esc 不误触", state()["screen"] == "menu")
        click_world(360, 742)
        time.sleep(0.3)
        howto_open = state()["screen"] == "howto"
        ck.add("点击进入玩法说明", howto_open)
        page.keyboard.press("Escape")
        time.sleep(0.25)
        ck.add("Esc 退出说明", state()["screen"] == "menu")

        # ── 3. 单人开局 + 真点击对局 ──
        click_world(360, 518)
        time.sleep(0.6)
        st = state()
        ck.add("点击「单人」进入对局", st["screen"] == "playing" and st["mode"] == "solo")

        # 语言先切中文（默认）
        chops = 0
        hp_seen = set()
        for _ in range(1400):
            snap = page.evaluate("window.__ll.state")
            if snap["screen"] != "playing":
                break
            seg = snap["snap"]["seg"]
            players = snap["snap"]["players"]
            hp_seen.add((players[0]["hp"], players[1]["hp"]))
            if seg and seg["state"] in ("hint", "revealed"):
                shown = seg["shown"]
                if shown in ("L", "R"):
                    # 砍没有雷印的那一边
                    click_world(160 if shown == "R" else 560, 700)
                    chops += 1
                elif shown == "NONE":
                    click_world(160, 700)
                    chops += 1
            time.sleep(0.04)

        st = state()
        ck.add("对局能打到结算（真点击）", st["screen"] == "result", st["screen"])
        ck.add("实际发生了多次砍击", chops > 12, f"{chops} 次")
        ck.add("血量有变化（死亡/天雷生效）", len(hp_seen) > 1, sorted(hp_seen))
        page.screenshot(path=os.path.join(OUT, "10-verify-result.png"))

        # ── 4. 存档：最高夺木落盘 + 刷新保留 ──
        stored = page.evaluate("JSON.parse(localStorage.getItem('duomu:profile')||localStorage.getItem('duomu.save.v1')||'{}')")
        ck.add("对局后写入存档", isinstance(stored, dict) and stored.get("plays", 0) >= 1, stored)
        best_before = stored.get("bestLogs", 0)
        page.reload(wait_until="networkidle")
        page.wait_for_function("window.__game && window.__game.screen !== 'loading'", timeout=25000)
        time.sleep(0.3)
        menus = page.evaluate("window.__game.render && true")
        stored2 = page.evaluate("JSON.parse(localStorage.getItem('duomu:profile')||localStorage.getItem('duomu.save.v1')||'{}')")
        ck.add("刷新后存档保留", stored2.get("bestLogs", 0) == best_before, stored2)

        # ── 5. 暂停 / 继续（键盘） ──
        page.evaluate("window.__ll.start('solo','novice')")
        time.sleep(0.5)
        page.keyboard.press("p")
        time.sleep(0.25)
        paused = state()["screen"] == "pause"
        ck.add("P 键暂停", paused)
        page.keyboard.press("p")
        time.sleep(0.25)
        ck.add("P 键继续", state()["screen"] == "playing")

        # ── 6. 双人：四个操作盘都能点 ──
        page.keyboard.press("p")
        time.sleep(0.2)
        click_world(360, 616)      # 暂停面板里的「重开一局」
        time.sleep(0.3)
        page.evaluate("window.__ll.menu()")
        time.sleep(0.2)
        click_world(360, 634)      # 主菜单「双人 · 同屏」
        time.sleep(0.6)
        st = state()
        ck.add("双人模式开局", st["screen"] == "playing" and st["mode"] == "duo")
        before = page.evaluate("window.__ll.state.snap.players.map(p=>p.logs)")
        # 双人：四人操作盘 —— 一左 一右 | 二左 二右
        PAD = {0: {"L": 100, "R": 270}, 1: {"L": 450, "R": 625}}
        for _ in range(420):
            snap = page.evaluate("window.__ll.state")
            if snap["screen"] != "playing":
                break
            seg = snap["snap"]["seg"]
            if seg and seg["state"] == "revealed" and seg["shown"] in ("L", "R", "NONE"):
                safe = "R" if seg["shown"] == "L" else "L"
                for pl in (0, 1):
                    click_world(PAD[pl][safe], 1198)
                time.sleep(0.02)
            time.sleep(0.04)
        after = page.evaluate("window.__ll.state.snap.players.map(p=>p.logs)")
        ck.add("双人双方都能得分", after[0] > 0 and after[1] > 0, {"before": before, "after": after})
        page.screenshot(path=os.path.join(OUT, "11-verify-duo.png"))

        # ── 7. 双语都能画出来 ──
        page.evaluate("window.__ll.menu()")
        time.sleep(0.2)
        page.evaluate("window.__ll.lang('zh')")
        time.sleep(0.3)
        page.screenshot(path=os.path.join(OUT, "12-verify-menu-zh.png"))
        zh_ok = page.evaluate("""(() => {
          const c = document.getElementById('game').getContext('2d');
          const d = c.getImageData(0,0,720,1280).data; let nonblank = 0;
          for (let i=3;i<d.length;i+=4000) if (d[i]>0) nonblank++;
          return {lang: window.__game.lang, nonblank};
        })()""")
        ck.add("中文界面有画面", zh_ok["lang"] == "zh" and zh_ok["nonblank"] > 100, zh_ok)
        page.evaluate("window.__ll.lang('en')")
        time.sleep(0.2)

        # ── 8. 音效：不抛异常且有 AudioContext ──
        page.evaluate("window.__ll.menu()")
        click_world(360, 518)
        time.sleep(0.4)
        audio = page.evaluate("""(() => {
          try {
            const g = window.__game;
            return {ok: true, hasAudio: typeof window.AudioContext !== 'undefined'};
          } catch (e) { return {ok: false, err: String(e)}; }
        })()""")
        ck.add("音频接口可用且无异常", audio["ok"] and not pageerrors, {"audio": audio, "errors": pageerrors})

        # ── 9. 帧率 ──
        fps = page.evaluate("""new Promise((res)=>{const t=[];let l=performance.now();
          function f(ts){t.push(ts-l);l=ts;if(t.length<90)requestAnimationFrame(f);
          else{const a=t.slice(10).sort((x,y)=>x-y);res({avg:a.reduce((s,v)=>s+v,0)/a.length,p95:a[Math.floor(a.length*.95)]})}}
          requestAnimationFrame(f)})""")
        ck.add("帧率 ≥ 50fps（无头软件渲染）", 1000 / fps["avg"] >= 50, fps)
        result["frame"] = fps

        # ── 10. 移动端视口 ──
        for w, h, tag in ((390, 844, "13-verify-mobile-390x844"), (844, 390, "14-verify-mobile-844x390")):
            m = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2,
                                    is_mobile=True, has_touch=True)
            mp = m.new_page()
            mp.goto(url, wait_until="networkidle")
            mp.wait_for_function("window.__game && window.__game.screen !== 'loading'", timeout=25000)
            time.sleep(0.45)
            mp.screenshot(path=os.path.join(OUT, tag + ".png"))
            mbr = mp.locator("#game").bounding_box()
            inside = mbr["width"] <= w + 1 and mbr["height"] <= h + 1
            ck.add(f"移动端 {w}x{h} 画布不出界", inside, mbr)
            # 触屏点击一下能砍
            mp.evaluate("window.__ll.start('solo','novice')")
            time.sleep(0.5)
            logs_before = mp.evaluate("window.__ll.state.snap.players[0].logs")
            for _ in range(40):
                seg = mp.evaluate("window.__ll.state.snap.seg")
                if seg and seg["state"] == "revealed" and seg["shown"] in ("L", "R", "NONE"):
                    sx = 0.22 if seg["shown"] == "R" else 0.78
                    mp.touchscreen.tap(mbr["x"] + mbr["width"] * sx, mbr["y"] + mbr["height"] * 0.7)
                    break
                time.sleep(0.05)
            time.sleep(0.3)
            logs_after = mp.evaluate("window.__ll.state.snap.players[0].logs")
            ck.add(f"移动端 {w}x{h} 触屏可砍", logs_after > logs_before, {"before": logs_before, "after": logs_after})
            m.close()

        ctx.close()
        browser.close()

    httpd_ok = True

    # 失败分类
    err = [c for c in console if c["type"] == "error"]
    ck.add("整轮 0 console.error", not err, err)
    ck.add("整轮 0 pageerror", not pageerrors, pageerrors)
    ck.add("整轮 0 请求失败", not failed, [f["url"] for f in failed])

    total = len(ck.items)
    passed = sum(1 for c in ck.items if c["ok"])
    result["summary"] = {"total": total, "passed": passed, "ok": passed == total}
    with open(os.path.join(OUT, "verify-report.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"\n{passed}/{total} 通过")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
