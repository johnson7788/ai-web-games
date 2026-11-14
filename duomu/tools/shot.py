#!/usr/bin/env python3
"""浏览器冒烟 + 截图。

起一个临时静态服务器 → 真 Chromium 打开 → 收集 console/pageerror/404 →
按流程截图（主菜单 / 对局 / 暂停 / 结算）。

用法：python3 tools/shot.py [--out tests/artifacts] [--keep]
"""
import argparse
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
    handler = functools.partial(Quiet, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="tests/artifacts")
    ap.add_argument("--width", type=int, default=720)
    ap.add_argument("--height", type=int, default=1280)
    ap.add_argument("--tag", default="")
    args = ap.parse_args()

    out = os.path.join(ROOT, args.out)
    os.makedirs(out, exist_ok=True)
    port = free_port()
    serve(port)
    url = f"http://127.0.0.1:{port}/index.html"

    from playwright.sync_api import sync_playwright

    console, errors, failed = [], [], []
    report = {"url": url, "shots": [], "console": console, "pageerrors": errors, "requestfailed": failed}

    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=[
            "--no-sandbox", "--disable-dev-shm-usage",
            "--force-device-scale-factor=2",
        ])
        ctx = browser.new_context(
            viewport={"width": args.width, "height": args.height},
            device_scale_factor=2,
            reduced_motion="no-preference",
        )
        page = ctx.new_page()
        page.on("console", lambda m: console.append({"type": m.type, "text": m.text}))
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("requestfailed", lambda r: failed.append({"url": r.url, "err": r.failure}))

        page.goto(url, wait_until="networkidle")
        page.wait_for_function("window.__game && window.__game.screen !== 'loading'", timeout=20000)
        time.sleep(0.5)

        def shot(name):
            path = os.path.join(out, f"{args.tag}{name}.png")
            page.screenshot(path=path)
            report["shots"].append(os.path.relpath(path, ROOT))
            return path

        shot("01-menu")

        # 说明页
        page.evaluate("window.__ll.howto()")
        time.sleep(0.4)
        shot("02-howto")
        page.evaluate("window.__game.action('close-howto')")

        # 单人开局
        page.evaluate("window.__ll.start('solo','novice')")
        time.sleep(0.45)
        shot("03-game-start")

        # 打几下：按时间窗档次各来一刀
        for i in range(6):
            page.evaluate("window.__ll.advance(120)")
            side = "R" if i % 2 == 0 else "L"
            page.evaluate(f"window.__ll.strike(0,'{side}')")
            time.sleep(0.06)
        shot("04-game-chop")

        # 雷印展示（强制让当前木段亮出左侧雷印）
        page.evaluate("window.__ll.forceSeg('L')")
        time.sleep(0.25)
        shot("04b-rune-left")
        page.evaluate("window.__ll.forceSeg('BOTH')")
        time.sleep(0.25)
        shot("04c-rune-both")
        page.evaluate("window.__ll.forceSeg('HIDDEN')")

        # 暂停
        page.evaluate("window.__ll.pause()")
        time.sleep(0.35)
        shot("05-pause")
        page.evaluate("window.__ll.resume()")

        # 快进到结算
        page.evaluate("window.__ll.advance(45000)")
        time.sleep(0.3)
        st = page.evaluate("window.__ll.state")
        if st["screen"] != "result":
            page.evaluate("window.__game.run.players[0].hp = 1; window.__ll.advance(50)")
            page.evaluate("window.__game.run.players[0].hp = 0; window.__game.run.players[0].alive=false; window.__game.finishMatch()")
            page.evaluate("window.__game.render()")
            time.sleep(0.3)
        shot("06-result")

        # 双人模式
        page.evaluate("window.__ll.menu()")
        page.evaluate("window.__ll.start('duo','novice')")
        time.sleep(0.5)
        page.evaluate("window.__ll.advance(300)")
        shot("07-duo")

        st2 = page.evaluate("window.__ll.state")
        report["finalState"] = st2

        # 帧率采样
        fps = page.evaluate("""
        new Promise((resolve) => {
          const ts = [];
          let last = performance.now();
          function tick(t){ ts.push(t-last); last = t; if(ts.length<120) requestAnimationFrame(tick); else {
            const arr = ts.slice(10).sort((a,b)=>a-b);
            resolve({avg: arr.reduce((a,b)=>a+b,0)/arr.length, p95: arr[Math.floor(arr.length*0.95)]});
          }}
          requestAnimationFrame(tick);
        })
        """)
        report["frame"] = fps

        ctx.close()
        browser.close()

    report["ok"] = not errors and not [f for f in failed if "favicon" not in f["url"]]
    path = os.path.join(out, "shot-report.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(json.dumps({
        "ok": report["ok"],
        "pageerrors": errors,
        "requestfailed": [f["url"] for f in failed],
        "console_error": [c for c in console if c["type"] == "error"],
        "frame": fps,
        "shots": report["shots"],
    }, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
