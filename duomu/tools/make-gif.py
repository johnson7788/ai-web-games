#!/usr/bin/env python3
"""录一局短对局，转成列表页 hover 用的 game.gif（≤5MB）。"""
import functools, http.server, os, shutil, socket, socketserver, subprocess, sys, tempfile, threading, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p

def main():
    port = free_port()
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", port), functools.partial(Q, directory=ROOT))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    from playwright.sync_api import sync_playwright
    tmp = tempfile.mkdtemp()
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=["--no-sandbox"])
        ctx = b.new_context(viewport={"width": 480, "height": 854}, device_scale_factor=1,
                            record_video_dir=tmp, record_video_size={"width": 480, "height": 854})
        page = ctx.new_page()
        page.goto(f"http://127.0.0.1:{port}/index.html?lang=en", wait_until="networkidle")
        page.wait_for_function("window.__game && window.__game.screen!=='loading'", timeout=25000)
        time.sleep(0.6)
        page.evaluate("window.__ll.start('solo','veteran')")
        # 打几秒：读雷印，砍安全侧
        box = page.locator("#game").bounding_box()
        t0 = time.time()
        while time.time() - t0 < 8:
            st = page.evaluate("window.__ll.state")
            if st["screen"] != "playing":
                break
            seg = st["snap"]["seg"]
            if seg and seg["state"] in ("hint", "revealed") and seg["shown"] in ("L", "R", "NONE"):
                wx = 150 if seg["shown"] == "R" else 570
                page.mouse.click(box["x"] + wx / 720 * box["width"], box["y"] + 700 / 1280 * box["height"])
            time.sleep(0.09)
        ctx.close()
        b.close()

    vids = [f for f in os.listdir(tmp) if f.endswith(".webm")]
    if not vids:
        sys.exit("没有录到视频")
    src = os.path.join(tmp, vids[0])
    out = os.path.join(ROOT, "game.gif")
    # 12fps + 调色板，控制体积
    vf = ("fps=12,scale=400:-1:flags=lanczos,split[a][b];"
          "[a]palettegen=max_colors=128:stats_mode=diff[p];"
          "[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle")
    subprocess.run(["ffmpeg", "-y", "-i", src, "-t", "5", "-vf", vf, "-loop", "0", out],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"game.gif {os.path.getsize(out)/1024/1024:.2f} MB")

if __name__ == "__main__":
    main()
