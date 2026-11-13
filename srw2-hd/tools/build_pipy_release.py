#!/usr/bin/env python3
"""Build the static Pipygames release folder from the SRW2 HD source tree.

Only runtime assets are copied (no raw/AI source images), then platform
boot/SDK/domain bits are added to the copied index/config.
"""
from __future__ import annotations
import pathlib, shutil, re
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
OUT = REPO / "data" / "games" / "srw2-hd"

RUNTIME_ASSET_DIRS = [
    "assets/audio",
    "assets/hd/units",
    "assets/hd/units-side",
    "assets/hd/parts",
    "assets/hd/fantasy-tiles",
    "assets/hd/tiles-chr",
    "assets/hd/maps",
    "assets/hd/fx",
    "assets/hd/tiles",
]

def copytree(src: pathlib.Path, dst: pathlib.Path):
    dst.mkdir(parents=True, exist_ok=True)
    for p in src.rglob("*"):
        if p.is_dir():
            continue
        rel = p.relative_to(src)
        q = dst / rel
        q.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, q)

def poster():
    src = ROOT / "docs/screenshots/17-fantasy-map.webp"
    if not src.exists():
        src = ROOT / "docs/screenshots/16-clean-map.webp"
    im = Image.open(src).convert("RGB").resize((1280, 720), Image.LANCZOS)
    # cinematic dark left/bottom wash so the type reads
    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for x in range(1280):
        a = int(210 * max(0, (520 - x) / 520))
        od.line([(x, 0), (x, 720)], fill=(3, 7, 14, a))
    for y in range(720):
        a = int(180 * max(0, (y - 360) / 360))
        od.line([(0, y), (1280, y)], fill=(3, 7, 14, a))
    im = Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")
    d = ImageDraw.Draw(im)
    def font(size, bold=True):
        for p in ("/System/Library/Fonts/PingFang.ttc", "/System/Library/Fonts/Helvetica.ttc"):
            try:
                return ImageFont.truetype(p, size, index=0)
            except Exception:
                pass
        return ImageFont.load_default()
    d.text((72, 92), "SRW2 HD", font=font(92), fill=(245, 249, 255))
    d.text((78, 208), "TACTICAL MECHA SRPG", font=font(30), fill=(233, 179, 74))
    d.text((80, 560), "26 CHAPTERS  ·  80 UNITS  ·  BROWSER", font=font(22), fill=(160, 201, 235))
    d.text((80, 604), "Hand-painted maps · layered mecha cut-ins", font=font(20, False), fill=(190, 207, 228))
    out = ROOT / "poster.jpg"
    im.save(out, "JPEG", quality=86, optimize=True, progressive=True)
    print("poster", out, out.stat().st_size // 1024, "KB")

def build():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    for name in ("index.html", "styles.css", "favicon.svg"):
        shutil.copy2(ROOT / name, OUT / name)
    for name in ("src", "config", "data"):
        copytree(ROOT / name, OUT / name)
    for name in RUNTIME_ASSET_DIRS:
        copytree(ROOT / name, OUT / name)

    # Enable the existing domain lock in the release copy.
    dom_cfg = OUT / "src/sdk/sdk.config.js"
    s = dom_cfg.read_text()
    s = s.replace("enabled: false,", "enabled: true,", 1)
    dom_cfg.write_text(s)

    idx = (OUT / "index.html").read_text()
    idx = idx.replace(
        '<meta name="description" content="FC《第2次超级机器人大战》高清重制：原版关卡、原版剧情、原版规则，用矢量美术与现代化界面重新演绎。" />',
        '<meta name="description" content="SRW2 HD: a browser tactical mecha SRPG with 26 chapters, 80 units, hand-painted maps and layered cut-ins." />\n'
        '  <meta property="og:title" content="SRW2 HD — Tactical Mecha SRPG" />\n'
        '  <meta property="og:description" content="26 chapters, 80 units, hand-painted maps and layered mecha cut-ins." />\n'
        '  <meta property="og:image" content="poster.jpg" />\n'
        '  <meta property="og:type" content="game" />'
    )
    boot = '''<section id="boot" class="boot" aria-label="Loading">
  <div id="boot-bg" class="boot__bg"></div>
  <div class="boot__inner">
    <div id="boot-title" class="boot__title">SRW2 HD</div>
    <div class="boot__bar"><i id="boot-fill"></i></div>
    <div class="boot__row"><span class="boot__pct"><b id="boot-pct">0</b>%</span><span class="boot__mark">pipygames.com</span></div>
  </div>
</section>
'''
    idx = idx.replace('<body>', '<body>\n' + boot, 1)
    platform = '''  <script>
  /* Pipygames serves games under CSP sandbox without allow-same-origin.
     The ad SDK reads localStorage directly; provide a no-op storage shim
     inside the sandbox so its optional telemetry cannot break the game. */
  (function () {
    try { window.localStorage.getItem("__pipy_probe__"); }
    catch (e) {
      try {
        var noop = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {}, clear: function () {}, key: function () { return null; }, length: 0 };
        Object.defineProperty(window, "localStorage", { configurable: true, value: noop });
        Object.defineProperty(window, "sessionStorage", { configurable: true, value: noop });
      } catch (_) {}
    }
  })();
  </script>
  <script src="https://pipygames.com/sdk/pipysdk.min.js" data-app-id="srw2-hd"></script>
  <script>
  (function () {
    var bg = document.getElementById('boot-bg');
    if (bg) bg.style.backgroundImage = "url('poster.jpg')";
    var pct = document.getElementById('boot-pct'), fill = document.getElementById('boot-fill');
    var n = 0, timer = setInterval(function () {
      n = Math.min(100, n + 4 + Math.round(Math.random() * 7));
      if (pct) pct.textContent = String(n);
      if (fill) fill.style.width = n + '%';
      if (n >= 100) {
        clearInterval(timer);
        setTimeout(function () { document.getElementById('boot')?.classList.add('boot--done'); }, 220);
        setTimeout(function () { document.getElementById('boot')?.remove(); }, 900);
      }
    }, 55);
    window.addEventListener('load', function () {
      if (window.PipyGames && window.PipyGames.ready) {
        window.PipyGames.ready.then(function () {
          try { window.PipyGames.newRun(); window.PipyGames.track('game_loaded', { game: 'srw2-hd' }); } catch (e) {}
        }).catch(function () {});
      }
    });
  })();
  </script>
'''
    idx = idx.replace('  <script src="src/sdk/sdk.config.js"></script>', platform + '  <script src="src/sdk/sdk.config.js"></script>', 1)
    (OUT / "index.html").write_text(idx)

    css = (OUT / "styles.css").read_text()
    css += '''

/* Pipygames boot */
.boot { position: fixed; inset: 0; z-index: 999; display: grid; place-items: center; background: #04070d; transition: opacity .5s ease; }
.boot--done { opacity: 0; pointer-events: none; }
.boot__bg { position: absolute; inset: 0; background-size: cover; background-position: center; filter: brightness(.58) saturate(.9); }
.boot__inner { position: relative; width: min(760px, 82vw); text-align: left; }
.boot__title { font-family: var(--sans); font-size: clamp(54px, 8vw, 112px); font-weight: 900; letter-spacing: .04em;
  color: #f4f8ff; text-shadow: 0 0 30px rgba(94,200,255,.28); margin-bottom: 28px; }
.boot__bar { height: clamp(18px, 2.4vw, 30px); border: 2px solid rgba(233,179,74,.85); background: rgba(6,12,22,.8); box-shadow: 0 6px 0 rgba(0,0,0,.45); }
.boot__bar i { display: block; height: 100%; width: 0%; background: linear-gradient(90deg, #e9b34a, #5ec8ff); box-shadow: 0 0 18px rgba(94,200,255,.45); transition: width .08s linear; }
.boot__row { display: flex; justify-content: space-between; margin-top: 10px; font-family: var(--mono); font-size: 12px; color: #9fd8ff; letter-spacing: .18em; }
.boot__mark { color: #e9b34a; text-transform: lowercase; }
'''
    (OUT / "styles.css").write_text(css)
    poster()
    shutil.copy2(ROOT / "poster.jpg", OUT / "poster.jpg")
    print("release", OUT)

if __name__ == "__main__":
    build()
