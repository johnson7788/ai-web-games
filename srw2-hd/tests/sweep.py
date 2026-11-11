#!/usr/bin/env python3
"""srw2-hd 自动验收：26 话逐话加载 + 一回合 + 规则/存档/i18n/移动端检查

用法：
    python3 tests/sweep.py                 # 自动起本地静态服务器（随机端口）
    python3 tests/sweep.py --url http://127.0.0.1:8125
    python3 tests/sweep.py --headed        # 看着浏览器跑
    python3 tests/sweep.py --shots out/    # 额外输出关键截图

依赖：python3 -m pip install playwright && python3 -m playwright install chromium
退出码 0 = 全部通过。
"""
from __future__ import annotations

import argparse
import functools
import http.server
import json
import pathlib
import socket
import socketserver
import sys
import threading
import time

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]

PASS, FAIL = [], []


def check(name: str, ok: bool, detail: str = ""):
    (PASS if ok else FAIL).append((name, detail))
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail and not ok else ""))


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class ThreadedServer(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def serve() -> tuple[str, http.server.ThreadingHTTPServer]:
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    httpd = ThreadedServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{port}", httpd


class Probe:
    def __init__(self, page):
        self.page = page
        self.errors: list[str] = []
        self.failed: list[str] = []
        page.on("pageerror", lambda e: self.errors.append(f"pageerror: {e}"))
        page.on("console", lambda m: self.errors.append(f"console: {m.text}") if m.type == "error" else None)
        def _failed(r):
            if "ABORT" in str(r.failure or "").upper():
                return
            self.failed.append(r.url)
        page.on("requestfailed", _failed)
        page.on("response", lambda r: self.failed.append(f"{r.status} {r.url}") if r.status >= 400 else None)

    def goto(self, url: str):
        self.page.goto(url, wait_until="domcontentloaded")
        self.page.wait_for_timeout(900)

    def skip_dialogue(self, limit=120):
        for _ in range(limit):
            if not self.page.is_visible("#dialogue"):
                return
            self.page.click("#dialogue")
            self.page.wait_for_timeout(25)
        raise RuntimeError("dialogue did not close")

    def end_turn(self, timeout=30000):
        self.page.evaluate("void window.__ll.endTurn()")
        deadline = time.time() + timeout / 1000
        while time.time() < deadline:
            if self.page.is_visible("#dialogue"):
                self.page.click("#dialogue")
                self.page.wait_for_timeout(40)
                continue
            unlocked = self.page.evaluate("() => !window.G.app.locked")
            if unlocked:
                return True
            self.page.wait_for_timeout(120)
        return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="")
    ap.add_argument("--headed", action="store_true")
    ap.add_argument("--shots", default="")
    args = ap.parse_args()

    base = args.url
    httpd = None
    if not base:
        base, httpd = serve()
    shots = pathlib.Path(args.shots) if args.shots else None
    if shots:
        shots.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headed)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        probe = Probe(page)
        probe.goto(base + "/?lang=zh")

        print("\n[1] 启动 / 标题 / 简报")
        check("标题界面显示", page.is_visible("#titleScreen"))
        page.click("#btnStart")
        page.wait_for_timeout(500)
        probe.skip_dialogue()
        page.wait_for_timeout(300)
        hud = page.evaluate("window.__ll.getHud()")
        check("进入第 1 话战斗", hud["mode"] == "battle" and hud["chapter"] == 1, json.dumps(hud))
        check("第 1 话单位数 = 19", hud["units"] == 19, str(hud["units"]))
        check("HUD 显示关卡标题", "救出" in page.eval_on_selector("#hud-title", "e=>e.innerText"))

        print("\n[2] 26 话逐话加载 + 一回合")
        count = page.evaluate("window.__ll.scenarioCount")
        check("话数 = 26", count == 26, str(count))
        sweep = []
        for i in range(count):
            page.evaluate(f"window.__ll.loadScenario({i})")
            page.wait_for_timeout(120)
            info = page.evaluate("""() => {
              const b = window.__ll.state, app = window.G.app;
              const bad = b.units.filter(u => u.x < 0 || u.y < 0 || u.x >= b.cols || u.y >= b.rows);
              const seen = new Map(); const overlaps = [];
              for (const u of b.units) {
                const k = u.x + ',' + u.y;
                if (seen.has(k)) overlaps.push([k, seen.get(k).name, u.name]);
                seen.set(k, u);
              }
              const onWall = b.units.filter(u => u.alive && !E_passable(b, u.x, u.y)).length;
              function E_passable(st, x, y) {
                const row = st.map[y]; const t = row && row[x];
                return !!(t && (t.pass || (t.move && (t.move.land > 0 || t.move.air > 0))));
              }
              const passable = b.map.flat().filter(t => t.pass || (t.move && (t.move.land > 0 || t.move.air > 0))).length;
              return { id: b.scenario.id, ch: b.scenario.chapter, cols: b.cols, rows: b.rows,
                       total: b.units.length,
                       onWall, passRatio: passable / (b.cols * b.rows),
                       players: b.units.filter(u => u.side === 'player').length,
                       enemies: b.units.filter(u => u.side === 'enemy').length,
                       npcs: b.units.filter(u => u.side === 'npc').length,
                       bad: bad.map(u => [u.name, u.x, u.y]), overlaps,
                       victory: b.scenario.objective.victory.type,
                       defeat: b.scenario.objective.defeat.type,
                       cam: [app.cam.x, app.cam.y],
                       goal: b.scenario.objective.victory };
            }""")
            ok_end = probe.end_turn()
            after = page.evaluate("""() => { const b = window.__ll.state;
              return { mode: window.G.app.mode, winner: b.winner, turn: b.turn,
                       phase: b.phase, units: b.units.length }; }""")
            sweep.append({**info, "after": after, "ended": ok_end})
            problems = []
            if info["total"] < 2:
                problems.append("单位过少")
            if info["bad"]:
                problems.append(f"越界 {info['bad']}")
            if info["overlaps"]:
                problems.append(f"重叠 {info['overlaps']}")
            if info["onWall"]:
                problems.append(f"{info['onWall']} 个单位站在不可通行格")
            if info["passRatio"] < 0.5:
                problems.append(f"可通行格过少 {info['passRatio']:.0%}")
            if not ok_end:
                problems.append("回合未结束")
            if after["winner"] is None and after["turn"] != 2:
                problems.append(f"回合数异常 {after['turn']}")
            check(f"{info['id']} 第{info['ch']}话 {info['cols']}x{info['rows']} "
                  f"P{info['players']}/E{info['enemies']}/N{info['npcs']}", not problems, "; ".join(problems))
            if shots and i in (0, 1, 6, 13, 20):
                page.screenshot(path=str(shots / f"sweep-{info['id']}.png"))

        print("\n[3] 规则与特殊关卡")
        # 第 2 话我方增援（第 3 回合）
        page.evaluate("window.__ll.loadScenario(1)")
        page.wait_for_timeout(150)
        before = page.evaluate("() => window.__ll.state.units.filter(u=>u.side==='player').length")
        for _ in range(2):
            probe.end_turn()
        after = page.evaluate("() => window.__ll.state.units.filter(u=>u.side==='player').length")
        check("第 2 话第 3 回合我方增援（6→7）", after == before + 1, f"{before}→{after}")

        # NPC
        page.evaluate("window.__ll.loadScenario(4)")
        page.wait_for_timeout(150)
        npc = page.evaluate("() => window.__ll.state.units.filter(u=>u.side==='npc').map(u=>u.name)")
        check("第 5 话存在 NPC", len(npc) >= 1, json.dumps(npc, ensure_ascii=False))

        # 撤离点
        page.evaluate("window.__ll.loadScenario(20)")
        page.wait_for_timeout(150)
        esc = page.evaluate("""() => {
          const E = window.G.engine, b = window.__ll.state;
          return { exit: b.scenario.objective.victory.exit,
                   bottom: E.isExitTile(b, 5, b.rows - 1),
                   notBottom: E.isExitTile(b, 5, b.rows - 2) };
        }""")
        check("第 21 话撤离点在下方", esc["exit"] == "bottom" and esc["bottom"] and not esc["notBottom"], json.dumps(esc))

        # 第 17 话 11 回合限制
        page.evaluate("window.__ll.loadScenario(16)")
        page.wait_for_timeout(150)
        limit = page.evaluate("""() => {
          const E = window.G.engine, b = window.__ll.state;
          b.turn = 12; E.checkEnd(b); return b.winner;
        }""")
        check("第 17 话超过 11 回合判负", limit == "defeat", str(limit))

        # 击破指定目标（第 26 话 → 瓦尔西昂）
        page.evaluate("window.__ll.loadScenario(25)")
        page.wait_for_timeout(150)
        win = page.evaluate("""() => {
          const E = window.G.engine, b = window.__ll.state;
          b.units.filter(u => u.side === 'enemy' && (u.key === 'ヴァルシオン')).forEach(u => { u.alive = false; u.hp = 0; });
          E.checkEnd(b); return b.winner;
        }""")
        check("第 26 话击坠瓦尔西昂 = 胜利", win == "victory", str(win))

        # 保护目标（第 8 话 → グレンダイザー）
        page.evaluate("window.__ll.loadScenario(7)")
        page.wait_for_timeout(150)
        lose = page.evaluate("""() => {
          const E = window.G.engine, b = window.__ll.state;
          b.units.filter(u => u.key === 'グレンダイザー').forEach(u => { u.alive = false; u.hp = 0; });
          E.checkEnd(b); return b.winner;
        }""")
        check("第 8 话グレンダイザー被击坠 = 失败", lose == "defeat", str(lose))

        print("\n[4] 侧栏操作 / 撤销移动")
        page.evaluate("window.__ll.loadScenario(0)")
        page.wait_for_timeout(150)
        setup = page.evaluate("""() => {
          const b = window.__ll.state, E = window.G.engine, app = window.G.app;
          const p = b.units.find(u => u.side === 'player' && !u.npc);
          const e = b.units.find(u => u.side === 'enemy' && u.alive);
          e.x = p.x + 1; e.y = p.y;
          app.selectedId = p.id; app.mode = 'action';
          app.actionList = E.attackOptions(b, p);
          app.repairList = [];
          window.G.ui.renderAll();
          return { p: p.name, e: e.name, hp: e.hp };
        }""")
        rows = page.query_selector_all("[data-attack]")
        check("射击按钮出现", len(rows) > 0, str(len(rows)))
        if rows:
            page.click("[data-attack]")
            page.wait_for_timeout(2800)
        attacks = page.evaluate("() => window.__ll.state.stats.attacks")
        check("攻击后统计增加", attacks >= 1, str(attacks))

        # 撤销移动
        page.evaluate("window.__ll.loadScenario(0)")
        page.wait_for_timeout(150)
        rev = page.evaluate("""() => {
          const b = window.__ll.state, app = window.G.app;
          const p = b.units.find(u => u.side === 'player' && !u.npc);
          const e = b.units.find(u => u.side === 'enemy' && u.alive);
          e.x = p.x + 3; e.y = p.y;
          window.__ll.select(p.id);
          return { id: p.id, from: [p.x, p.y] };
        }""")
        target = page.evaluate("""() => {
          const b = window.__ll.state, app = window.G.app;
          const e = b.units.find(x => x.side === 'enemy' && x.alive);
          const taken = new Set(b.units.filter(u => u.alive).map(u => u.x + ',' + u.y));
          return [...app.moveSet].map(k => k.split(',').map(Number))
            .find(([x, y]) => Math.abs(x - e.x) + Math.abs(y - e.y) === 1 && !taken.has(x + ',' + y));
        }""")
        if target:
            pos = page.evaluate(f"""() => {{
              const cam = window.G.app.cam, r = document.getElementById('map').getBoundingClientRect();
              return {{ x: r.left + ({target[0]} - cam.x + 0.5) * (r.width / 16),
                        y: r.top + ({target[1]} - cam.y + 0.5) * (r.height / 11) }};
            }}""")
            page.mouse.click(pos["x"], pos["y"])
            page.wait_for_timeout(700)
            mode = page.evaluate("window.G.app.mode")
            page.keyboard.press("Escape")
            page.wait_for_timeout(250)
            back = page.evaluate(f"() => {{ const u = window.__ll.state.units.find(u => u.id === '{rev['id']}'); return [u.x, u.y, u.moved, u.acted]; }}")
            check("移动后 Esc 撤销并回退", mode == "action" and back[:2] == rev["from"] and not back[2] and not back[3],
                  f"{mode} {back}")

        print("\n[5] 存档 / 读档")
        page.evaluate("window.__ll.loadScenario(4)")
        page.wait_for_timeout(150)
        npc_before = page.evaluate("() => window.__ll.state.units.filter(u=>u.side==='npc').map(u=>u.name)")
        page.evaluate("document.getElementById('btnSave').click()")
        page.wait_for_timeout(200)
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(700)
        page.click("#btnContinue")
        page.wait_for_timeout(700)
        npc_after = page.evaluate("() => window.__ll.state ? window.__ll.state.units.filter(u=>u.side==='npc').map(u=>u.name) : null")
        check("读档保留 NPC", npc_before == npc_after, f"{npc_before} → {npc_after}")
        check("读档后在第 5 话", page.evaluate("() => window.__ll.getHud().chapter") == 5)

        print("\n[6] i18n")
        page.click("#btnLang")
        page.wait_for_timeout(300)
        en = page.eval_on_selector(".hud-left", "e => e.innerText")
        obj = page.eval_on_selector("#objective", "e => e.innerText")
        check("切换到英文", "Stage" in en and "PLAYER PHASE" in en, en.replace("\n", " / "))
        check("目标文字本地化", "Destroy" in obj or "Escape" in obj or "Protect" in obj, obj)
        page.click("#btnLang")
        page.wait_for_timeout(250)
        check("切回中文", "第" in page.eval_on_selector(".hud-left", "e => e.innerText"))

        print("\n[7] 移动端")
        mobile = browser.new_page(viewport={"width": 390, "height": 844})
        mp = Probe(mobile)
        mp.goto(base + "/?lang=zh")
        overflow = mobile.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
        check("390×844 无横向溢出", overflow <= 1, f"{overflow}px")
        mp.errors.clear()
        mobile.close()

        print("\n[7b] 备用底图 / 音频 / SDK")
        ai_page = browser.new_page(viewport={"width": 1280, "height": 800})
        ap = Probe(ai_page)
        ap.goto(base + "/?maps=ai&lang=zh")
        ai_page.click("#btnStart")
        ai_page.wait_for_timeout(400)
        ap.skip_dialogue()
        ai_page.wait_for_timeout(900)
        ai_ok = ai_page.evaluate("() => !!window.__ll.state && window.__ll.getHud().mode === 'battle'")
        check("?maps=ai 可加载且无 404", ai_ok and not ap.failed, json.dumps(ap.failed[:3]))
        ai_page.close()

        page.evaluate("window.__ll.loadScenario(5)")
        page.wait_for_timeout(200)
        ch = page.evaluate("() => window.__ll.getHud().chapter")
        bgm = page.evaluate("() => { const a = document.getElementById('bgm'); return { rate: a.playbackRate, src: a.currentSrc, vol: a.volume }; }")
        expect = f"nsf/track-{(ch - 1) % 19:02d}.mp3"
        check("各话战场 BGM 来自 NSF 音轨", expect in bgm["src"], json.dumps(bgm))
        page.evaluate("window.G.audio.play('battle', 1)")
        page.wait_for_timeout(200)
        battle_src = page.evaluate("() => document.getElementById('bgm').currentSrc")
        check("战斗 BGM 可切换", battle_src.endswith("bgm-sortie.mp3"), battle_src)
        page.evaluate("window.G.audio.play('boss', 1)")
        page.wait_for_timeout(200)
        boss_src = page.evaluate("() => document.getElementById('bgm').currentSrc")
        check("BOSS BGM 可切换", boss_src.endswith("nsf/track-16.mp3"), boss_src)
        missing = [i for i in range(19) if not (ROOT / f"assets/audio/nsf/track-{i:02d}.mp3").exists()]
        check("19 条 NSF 音轨文件齐全", not missing, json.dumps(missing))
        sdk = page.evaluate("""() => ({ has: !!window.GameSDK, events: (localStorage.getItem('srw2hd.sdk.events') || '').length })""")
        check("SDK 已加载并记录事件", sdk["has"] and sdk["events"] > 2, json.dumps(sdk))

        print("\n[7c] 胜利结算 / 下一话 / 最终话")
        page.evaluate("window.__ll.loadScenario(0)")
        page.wait_for_timeout(200)
        page.evaluate("void window.__ll.forceVictory()")
        deadline = time.time() + 8
        while time.time() < deadline and not page.is_visible("#result"):
            if page.is_visible("#dialogue"):
                page.click("#dialogue")
            page.wait_for_timeout(80)
        check("胜利后出现结算", page.is_visible("#result"))
        title = page.eval_on_selector("#resultTitle", "e => e.innerText")
        check("结算显示当前话数", "1" in title, title)
        check("有「下一话」按钮", page.is_visible("#btnNext") and not page.evaluate("() => document.getElementById('btnNext').hidden"))
        page.click("#btnNext")
        page.wait_for_timeout(700)
        probe.skip_dialogue()
        page.wait_for_timeout(400)
        check("下一话进入第 2 话", page.evaluate("() => window.__ll.getHud().chapter") == 2)

        page.evaluate("window.__ll.loadScenario(25)")
        page.wait_for_timeout(200)
        page.evaluate("void window.__ll.forceVictory()")
        deadline = time.time() + 8
        while time.time() < deadline and not page.is_visible("#result"):
            if page.is_visible("#dialogue"):
                page.click("#dialogue")
            page.wait_for_timeout(80)
        check("最终话结算不显示「下一话」", page.evaluate("() => document.getElementById('btnNext').hidden"))

        print("\n[8] 资源 / 控制台")
        check("无 404 / 请求失败", not probe.failed, json.dumps(probe.failed[:6]))
        check("无页面错误", not probe.errors, json.dumps(probe.errors[:6], ensure_ascii=False))

        # —— 内容升级（有产物时校验）——
        if (ROOT / "data/maps-final.json").exists():
            sources = page.evaluate("() => window.G.app.scenarios.map((s) => s.mapSource)")
            check("26 话地图来自 CHR 精确提取", len(sources) == 26 and all(x == "chr" for x in sources),
                  json.dumps({x: sources.count(x) for x in set(sources)}))
            tile_info = page.evaluate("""async () => {
              const s = await import('/config/scenarios.js');
              const a = await import('/config/tile-atlas.js');
              return {
                chapters: s.SCENARIOS.length,
                grids: s.SCENARIOS.filter(x => Array.isArray(x.tileGrid) && x.tileGrid.length).length,
                tiles: Object.keys(a.TILE_ATLAS).length,
                fallback: Object.keys(a.TILE_FALLBACK).length,
              };
            }""")
            check("地图按格重建（26 话 tileGrid）", tile_info["chapters"] == 26 and tile_info["grids"] == 26, json.dumps(tile_info))
            check("地形 Tile 图集覆盖 26 话", tile_info["tiles"] >= 30 and tile_info["fallback"] >= 20, json.dumps(tile_info))
            clean_maps = list((ROOT / "assets" / "hd" / "maps-clean").glob("*.webp"))
            check("HD 清图已生成（26 话）", len(clean_maps) == 26, str(len(clean_maps)))
            fantasy_tiles = list((ROOT / "assets" / "hd" / "fantasy-tiles").glob("*.webp"))
            check("手绘奇幻 tile 已生成（≥16）", len(fantasy_tiles) >= 16, str(len(fantasy_tiles)))
            fantasy_status = page.evaluate("async () => (await fetch('/assets/hd/fantasy-tiles/plain.webp')).status")
            check("默认地图使用手绘 tile", fantasy_status == 200, str(fantasy_status))
        if (ROOT / "data/sprites-plan.json").exists():
            info = page.evaluate("async () => { const m = await import('/config/sprites-generated.js'); return { ai: m.AI_HD.length, map: m.GENERATED_MAP.length }; }")
            check("AI 机体立绘已接入（≥50 台）", info["ai"] >= 50, json.dumps(info))
        if (ROOT / "data/unit-parts.json").exists():
            import json as _json
            import numpy as np
            from PIL import Image
            parts_meta = _json.loads((ROOT / "data/unit-parts.json").read_text())
            names = ["head", "torso", "arm-l", "arm-r", "leg-l", "leg-r"]
            complete = len(parts_meta) == 80 and all(all(n in v for n in names) for v in parts_meta.values())
            check("80 台机体分层素材完整（头/躯干/四肢）", complete,
                  f"units={len(parts_meta)} parts={sum(len(v) for v in parts_meta.values())}")
            bad = []
            for key, layers in parts_meta.items():
                src = Image.open(ROOT / "assets" / "hd" / "units-side" / f"{key}.webp").convert("RGBA")
                canvas = Image.new("RGBA", src.size, (0, 0, 0, 0))
                for n in names:
                    p = layers.get(n)
                    if not p or p.get("fallback"):
                        continue
                    canvas.alpha_composite(Image.open(ROOT / p["file"]).convert("RGBA"), (p["x"], p["y"]))
                a = np.array(src); b = np.array(canvas)
                mask = a[:, :, 3] > 12
                if mask.any() and int(np.abs(a.astype(int) - b.astype(int))[mask].max()) > 2:
                    bad.append(key)
            check("分层素材可逐像素还原原图（80 台）", not bad, f"mismatch={bad[:5]}")
        if (ROOT / "data/script-zh.json").stat().st_size > 100:
            script = page.evaluate("async () => { const r = await fetch('data/script-zh.json'); const j = await r.json(); return { keys: Object.keys(j).length, ch1: (j['01'] && j['01'].lines || []).length }; }")
            check("剧情台本已加载（26 话）", script["keys"] >= 26 and script["ch1"] > 20, json.dumps(script))
            page.evaluate("window.__ll.start(0)")
            page.wait_for_timeout(700)
            if page.is_visible("#dialogue"):
                txt = page.inner_text("#dlgText")
                check("剧情对话可播放", len(txt.strip()) > 0, txt[:40])
                for _ in range(500):
                    if not page.is_visible("#dialogue"):
                        break
                    page.click("#dialogue")
                    page.wait_for_timeout(12)

        # —— 战斗动作（按武器类型）——
        pairs = page.evaluate("""async () => {
          const m = await import('/src/render/combat-anim.js');
          const names = ['光束步枪','光束军刀','火箭飞拳','胸部火焰','主炮','导弹','地图兵器','热能斧',
                         '机枪','扩散光束','光弹','格斗','舰炮','机炮','加农炮','固定炮','反射光','弹头',
                         '盖塔战斧','盖塔射线'];
          return names.map((n) => [n, m.weaponAnim({ name: n }).kind]);
        }""")
        expect = {
            "光束步枪": "beam", "光束军刀": "saber", "火箭飞拳": "punch", "胸部火焰": "fire",
            "主炮": "cannon", "导弹": "missile", "地图兵器": "map", "热能斧": "axe",
            "机枪": "mg", "扩散光束": "spread", "光弹": "ball", "格斗": "punch",
            "舰炮": "cannon", "机炮": "mg", "加农炮": "cannon", "固定炮": "cannon",
            "反射光": "ball", "弹头": "missile", "盖塔战斧": "axe", "盖塔射线": "beam",
        }
        bad = [(n, k, expect.get(n)) for n, k in pairs if expect.get(n) != k]
        check("20 种武器都有专属战斗动作", not bad, json.dumps(bad, ensure_ascii=False))
        page.evaluate("window.__ll.loadScenario(0)")
        page.wait_for_timeout(300)
        page.evaluate("window.__ll.demoCutin('地图兵器', 'beam')")
        page.wait_for_timeout(1100)
        label = page.inner_text("#cutinMove")
        px = page.evaluate("""() => { const c = document.getElementById('cutinFx');
          if (!c || !c.width) return 0;
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n += 1; return n; }""")
        check("战斗动作 Canvas 实际绘制", "地图兵器" in label and px > 1000, f"{label} px={px}")
        page.wait_for_timeout(1200)

        # —— 侧面战斗立绘 ——
        if (ROOT / "data/side-sprites.json").exists():
            n_side = page.evaluate("async () => { const m = await import('/config/sprites-generated.js'); return m.SIDE_KEYS.length; }")
            check("侧面战斗立绘已接入（≥70）", n_side >= 70, str(n_side))
            page.evaluate("window.__ll.loadScenario(0)")
            page.wait_for_timeout(300)
            page.evaluate("window.__ll.demoCutin('光束步枪', 'beam', 'gundam')")
            page.wait_for_timeout(360)
            side_src = page.eval_on_selector("#cutinA", "e => e.src")
            check("cut-in 使用侧面立绘", "units-side" in side_src, side_src)
            page.wait_for_timeout(1400)

        # —— 骨骼 / 武器 socket / 状态机 ——
        rig_info = page.evaluate("""async () => {
          const m = await import('/src/render/skeletal.js');
          const r = new m.SkeletalRig({ base: { x: 120, y: 300 }, bodyW: 120, bodyH: 200, palette: {}, kind: 'beam' });
          r.pose(0.30, 'windup', 'beam', 520);
          const h = { ...r.hand.world }, mu = { ...r.muzzle.world };
          r.pose(0.45, 'attack', 'beam', 520);
          const h2 = { ...r.hand.world }, mu2 = { ...r.muzzle.world };
          return { h, mu, h2, mu2, bones: ['root','torso','shoulder','upper','fore','hand','weaponSocket','muzzle'].every(n => { let b = r.root; while (b && b.name !== n) { let f = null; const q=[...b.children]; while(q.length){const x=q.shift(); if(x.name===n){f=x;break;} q.push(...x.children);} b=f; } return !!b; }) };
        }""")
        check("骨骼/武器 socket 跟随手部", rig_info["bones"] and rig_info["mu"]["x"] > rig_info["h"]["x"] + 10 and rig_info["mu2"]["x"] > rig_info["h2"]["x"] + 10,
              json.dumps(rig_info))
        fsm_info = page.evaluate("""async () => {
          const m = await import('/src/game/combat-fsm.js');
          const f = new m.CombatStateMachine();
          const out = [];
          for (const t of [0.0, 0.12, 0.36, 0.40, 0.58, 0.66]) out.push({ t, ev: f.update(t), state: f.state });
          return { out, fired: f.fired, impacted: f.impacted };
        }""")
        states = [x["state"] for x in fsm_info["out"]]
        events = [e["type"] for x in fsm_info["out"] for e in x["ev"]]
        check("动画状态机/事件顺序", "windup" in states and "attack" in states and "recover" in states and "fire" in events and "impact" in events and fsm_info["fired"] and fsm_info["impacted"],
              json.dumps(fsm_info))

        # —— 闪避 / 命中 ——
        page.evaluate("window.__ll.loadScenario(0)")
        page.wait_for_timeout(300)
        page.evaluate("window.__ll.demoCutin('光束步枪', 'beam', 'gundam', false)")
        page.wait_for_timeout(1250)
        miss = page.evaluate("() => ({ cls: document.getElementById('cutin').className, dmg: document.getElementById('cutinDmg').textContent })")
        check("未命中：目标闪避并显示「回避」", "dodge" in miss["cls"] and miss["dmg"] in ("回避", "DODGE"), json.dumps(miss, ensure_ascii=False))
        page.wait_for_timeout(1400)
        page.evaluate("window.__ll.demoCutin('光束步枪', 'beam', 'gundam', true)")
        page.wait_for_timeout(1250)
        hit = page.evaluate("() => ({ cls: document.getElementById('cutin').className, dmg: document.getElementById('cutinDmg').textContent })")
        check("命中：目标受击并显示伤害", "fx-hit" in hit["cls"] and hit["dmg"].startswith("-"), json.dumps(hit, ensure_ascii=False))
        page.wait_for_timeout(1400)

        # —— 回合切换中央横幅 ——
        page.evaluate("window.__ll.loadScenario(0)")
        page.wait_for_timeout(500)
        page.evaluate("void window.__ll.endTurn()")
        page.wait_for_timeout(260)
        phase = page.evaluate("""() => ({
          hidden: document.getElementById('phaseBanner').hidden,
          show: document.getElementById('phaseBanner').classList.contains('show'),
          main: document.getElementById('phaseBannerMain').textContent,
          sub: document.getElementById('phaseBannerSub').textContent,
          hud: document.getElementById('phaseTag').textContent,
          turn: document.getElementById('turnNum').textContent,
        })""")
        check("回合切换中央横幅", (not phase["hidden"]) and phase["show"] and "回合结束" in phase["main"] and "第" in phase["main"] and "敌方阶段" in phase["hud"] and phase["turn"] == "01",
              json.dumps(phase, ensure_ascii=False))
        for _ in range(120):
            if not page.evaluate("() => window.G.app.locked"):
                break
            page.wait_for_timeout(100)

        # —— 射程校验 ——
        page.evaluate("window.__ll.loadScenario(0)")
        page.wait_for_timeout(500)
        far = page.evaluate("""() => {
          const a = window.G.app;
          const p = a.battle.units.find(u => u.side === 'player' && u.alive && u.weapons.length);
          if (!p) return null;
          const maxR = Math.max(...p.weapons.map(w => w.range));
          const e = a.battle.units.find(u => u.side === 'enemy' && u.alive && Math.abs(u.x - p.x) + Math.abs(u.y - p.y) > maxR);
          if (!e) return null;
          const hp = e.hp;
          a.selectedId = p.id; a.mode = 'battle';
          window.__ll.attack(e.id, 0);
          return { id: e.id, hp, dist: Math.abs(e.x - p.x) + Math.abs(e.y - p.y), maxR };
        }""")
        page.wait_for_timeout(500)
        if far:
            after_hp = page.evaluate(f"() => {{ const u = window.G.app.battle.units.find(u => u.id === '{far['id']}'); return u ? u.hp : null; }}")
            check("超出射程攻击被拒绝", after_hp == far["hp"] and not page.is_visible("#cutin"), json.dumps(far))
        else:
            check("超出射程攻击被拒绝", True, "第 1 话没有超出射程的目标，跳过")

        # —— 敌方会主动攻击 ——
        page.evaluate("window.__ll.loadScenario(0)")
        page.wait_for_timeout(400)
        setup = page.evaluate("""() => {
          const a = window.G.app;
          const p = a.battle.units.find(u => u.side === 'player');
          const e = a.battle.units.find(u => u.side === 'enemy');
          e.x = p.x; e.y = p.y - 1; e.move = 0;
          a.battle.units.filter(u => u.id !== e.id).forEach(u => { if (u.side === 'enemy') u.alive = false; });
          return { hp: p.hp, pid: p.id };
        }""")
        page.evaluate("void window.__ll.endTurn()")
        for _ in range(200):
            if not page.evaluate("() => window.G.app.locked"):
                break
            page.wait_for_timeout(100)
        after = page.evaluate(f"() => {{ const u = window.G.app.battle.units.find(u => u.id === '{setup['pid']}'); return u ? u.hp : 0; }}")
        check("敌方会主动攻击", after < setup["hp"], f"hp {setup['hp']} -> {after}")

        # —— 鼠标操作 / 攻击后继续行动 ——
        page.evaluate("window.__ll.loadScenario(0)")
        page.wait_for_timeout(500)
        cam_before = page.evaluate("() => ({ ...window.G.app.cam })")
        page.mouse.move(500, 300)
        page.wait_for_timeout(300)
        cam_after = page.evaluate("() => ({ ...window.G.app.cam })")
        check("鼠标悬停不再带动地图", cam_before == cam_after, f"{cam_before} -> {cam_after}")

        page.evaluate("""() => {
          const a = window.G.app;
          const p = a.battle.units.find(u => u.side === 'player' && u.alive);
          const e = a.battle.units.find(u => u.side === 'enemy' && u.alive);
          a.selectedId = p.id; a.mode = 'battle';
          window.__ll.attack(e.id, 0);
        }""")
        page.wait_for_timeout(6200)
        after = page.evaluate("() => { const a = window.G.app; return { locked: a.locked, mode: a.mode, selected: a.selectedId, acted: a.battle.units.filter(u => u.side === 'player' && u.acted).length }; }")
        # 点击另一个未行动机体的“头部”位置，验证能选中并出现移动范围
        clicked = page.evaluate("""() => {
          const a = window.G.app;
          const u = a.battle.units.find(x => x.side === 'player' && x.alive && !x.acted);
          if (!u) return null;
          a.cam.x = Math.max(0, Math.min(a.battle.cols - 16, u.x - 8));
          a.cam.y = Math.max(0, Math.min(a.battle.rows - 11, u.y - 5));
          const r = document.getElementById('map').getBoundingClientRect();
          return { id: u.id, x: r.left + ((u.x - a.cam.x) * 55 + 27.5) / 880 * r.width, y: r.top + ((u.y - a.cam.y) * 55 + 27.5 + 18 - 40) / 605 * r.height };
        }""")
        if clicked:
            page.mouse.click(clicked["x"], clicked["y"])
            page.wait_for_timeout(500)
            now = page.evaluate("() => ({ sel: window.G.app.selectedId, mode: window.G.app.mode, move: window.G.app.moveSet ? window.G.app.moveSet.size : 0, locked: window.G.app.locked })")
            check("攻击后其他单位仍可选中/移动", after["locked"] is False and after["mode"] == "battle" and now["sel"] == clicked["id"] and now["mode"] == "move" and now["move"] > 0,
                  json.dumps({"after": after, "now": now}, ensure_ascii=False))
        else:
            check("攻击后其他单位仍可选中/移动", False, "no unacted unit")

        browser.close()
    if httpd:
        httpd.shutdown()

    print(f"\n===== {len(PASS)} passed, {len(FAIL)} failed =====")
    for name, detail in FAIL:
        print("  FAILED:", name, detail)
    return 0 if not FAIL else 1


if __name__ == "__main__":
    raise SystemExit(main())
