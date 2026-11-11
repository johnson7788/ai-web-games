#!/usr/bin/env python3
"""生成 config/scenarios.js

输入：
  data/gcgx.json      GCGX 逐话攻略（坐标 / 等级 / 经验 / 增援 / NPC / 目标）
  data/story.json     中文标题 / 摘要 / 战术简报 / 目标翻译（人工整理）
  tools/terrain.py    官方地图 → 地形字符矩阵

输出：config/scenarios.js（带地图尺寸、地形、单位、胜负条件）

用法：python3 tools/build_scenarios.py
"""
from __future__ import annotations

import json
import pathlib
import re
import unicodedata

import terrain

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "config" / "scenarios.js"

# 中文话数标题（与 data/story.json 合并，后者优先）
TITLES = {
    "01": "救出!!Z高达", "02": "谋略之城", "03": "达卡尔之血", "04": "反击",
    "05": "背叛的荒野", "06": "破坏敌要塞", "07": "决斗", "08": "圈套",
    "09": "复仇之风", "10": "傀儡凤", "11": "惊异!!究极机器人瓦尔西昂",
    "12": "拉萨攻防", "13": "西洛克的影子", "14": "前往宇宙",
    "15": "激斗！朱庇特利斯", "16": "脱出！", "17": "太阳射线发动",
    "18": "潜入！康佩特", "19": "月面死斗", "20": "决战!!格拉纳达要塞",
    "21": "时间啊停下", "22": "大气层突入", "23": "西洛克的逆袭",
    "24": "基尔基尔甘的亡灵", "25": "最后巴塔利昂再临", "26": "黎明的决战"
}

TITLES_EN = {
    "01": "Rescue! Z Gundam", "02": "City of Schemes", "03": "Suppress Dakar",
    "04": "Counterattack", "05": "Wilderness of Betrayal", "06": "Destroy the Enemy Fortress",
    "07": "Duel! Line X1", "08": "Macbe's Trap", "09": "Wind of Revenge",
    "10": "Marionette Four", "11": "Terror! Ultimate Robot Valsione",
    "12": "Battle of Lhasa", "13": "Scirocco's Shadow", "14": "Into Space",
    "15": "Clash! Jupiteris", "16": "Escape!", "17": "Solar Ray Activated",
    "18": "Infiltrate! Konpeito", "19": "Deathmatch on the Moon",
    "20": "Decisive Battle! Granada", "21": "Time, Stand Still",
    "22": "Atmospheric Entry", "23": "Scirocco's Counterattack",
    "24": "Ghost of Girgilgan", "25": "Last Battalion Returns",
    "26": "Decisive Battle at Dawn"
}

# 特殊单位：不可移动 / NPC 离场回合（人工整理，来自攻略文本）
IMMOBILE = {
    "11": ["ミデア"],
    "22": ["ラー・カイラム"]
}
NPC_CONFIG = {
    "05": {"サイコガンダム": {"leaveTurn": 3}},
    "07": {"サイバスター": {"leaveTurn": 1}},
    "11": {"ミデア": {"immobile": True}}
}

JOIN = {
    "01": "Z高达", "02": "—", "03": "F91、爱美神", "04": "—", "05": "—",
    "06": "胡蝶鬼", "07": "波西", "08": "密涅瓦X、古连泰沙", "09": "ZZ高达",
    "10": "精神感应高达", "11": "塞巴斯塔", "12": "ν高达、大魔神、盖塔G",
    "13": "—", "14": "—", "15": "—", "16": "—", "17": "丘贝雷MkⅡ", "18": "—",
    "19": "—", "20": "—", "21": "—", "22": "精神感应高达MkⅡ", "23": "—",
    "24": "昆曼沙", "25": "—", "26": "—"
}

# 目标文字 → 需要击坠的机体（日文原名）
DESTROY_ALIASES = {
    "ラインＸ１": ["ラインＸ１"], "ギャン": ["ギャン"], "ジ・オ": ["ジ・オ"],
    "ラフレシア": ["ラフレシア"], "ヴァルシオン": ["ヴァルシオン"],
    "ビグザム": ["ビグザム"], "ソーラレイ": ["発電ミラー"]
}


def norm(name: str) -> str:
    return re.sub(r"\s+", "", str(name)).replace("（.*?）", "")


def clean_name(name: str) -> str:
    """去掉换行与括号注释：'クインマンサ\\n （サイコガンダムmkⅡ）' → 'クインマンサ'"""
    s = str(name or "")
    s = s.replace("\n", " ").replace("\r", " ")
    s = re.sub(r"[（(].*?[）)]", "", s)
    s = re.sub(r"\s+", "", s)
    return s


def unit_obj(u: dict) -> dict:
    if u.get("x") is None or u.get("y") is None:
        return None
    out = {"unit": clean_name(u["unit"]), "x": u["x"], "y": u["y"]}
    if u.get("lv"):
        out["lv"] = u["lv"]
    if u.get("pilot"):
        out["pilot"] = u["pilot"].replace("\n", " ")
    if u.get("exp"):
        out["exp"] = u["exp"]
    if u.get("money"):
        out["money"] = u["money"]
    if u.get("ai"):
        out["ai"] = u["ai"]
    if u.get("ability"):
        out["ability"] = u["ability"]
    return out


def conditions(ch: str, d: dict) -> tuple[dict, dict]:
    vic = unicodedata.normalize("NFKC", (d["objective"].get("victory") or "").replace("\n", ""))
    defe = (d["objective"].get("defeat") or "").replace("\n", "")

    victory = {"type": "annihilate"}
    if "脱出" in vic:
        victory = {"type": "escape", "exit": "right" if ch == "16" else "bottom"}
        if ch == "21":
            victory["turns"] = 15
    elif any(k in vic for k in ("倒す", "破壊", "倒せ")):
        targets = []
        for alias, units in DESTROY_ALIASES.items():
            if unicodedata.normalize("NFKC", alias) in vic:
                targets += units
        # 第 24 话官网写的是「ジ・オ」，但本关敌人是基尔基尔甘（攻略正文也这么说）
        if ch == "24":
            targets = ["ギルギルガン"]
        victory = {"type": "destroy", "targets": targets or ["__boss__"]}
        if "制限時間" in vic or ch == "17":
            victory["turns"] = 11
    elif "守り抜く" in vic:
        victory = {"type": "survive", "turns": 20}
    elif "守りつつ" in vic:
        victory = {"type": "annihilate"}
    # 大多数关卡都允许「敌全灭」作为替代胜利条件
    if victory["type"] in ("destroy", "escape", "survive"):
        victory["orAnnihilate"] = True

    defeat = {"type": "annihilate"}
    m = re.search(r"(\d+)\s*ターンの経過", defe)
    if m:
        defeat = {"type": "turnLimit", "turns": int(m.group(1))}
    elif "破壊され" in defe:
        names = []
        for key in ("グレンダイザー", "ミデア", "ネェル・アーガマ", "ラー・カイラム"):
            if key in defe:
                names.append(key)
        defeat = {"type": "protect", "units": names}
    return victory, defeat


def main() -> int:
    gcgx = json.loads((ROOT / "data" / "gcgx.json").read_text())
    chr_maps = {}
    for name in ("maps-final.json", "maps-chr.json"):
        cmap = ROOT / "data" / name
        if cmap.exists():
            chr_maps = json.loads(cmap.read_text())
            break

    story = {}
    sp = ROOT / "data" / "story.json"
    if sp.exists():
        story = json.loads(sp.read_text())

    lines = [
        "// 26 话主数据：地形/尺寸由 tools/build_scenarios.py 从官方地图生成，",
        "// 站位/等级/增援/NPC 来自 data/gcgx.json（GCGX 攻略），请勿手改。",
        "export const SCENARIOS = [",
    ]

    for i in range(1, 27):
        ch = f"{i:02d}"
        d = gcgx[ch]
        need = (max([u["x"] for u in d["allies"] + d["enemies"] + d["npc"]
                     if u.get("x") is not None] + [0]) + 1,
                max([u["y"] for u in d["allies"] + d["enemies"] + d["npc"]
                     if u.get("y") is not None] + [0]) + 1)
        for r in d["reinforcements"]:
            for u in r["units"]:
                if u.get("x") is None or u.get("y") is None:
                    continue
                need = (max(need[0], u["x"] + 1), max(need[1], u["y"] + 1))

        mask = {(u["x"], u["y"]) for k in ("allies", "enemies", "npc")
                for u in d[k] if u.get("x") is not None and u.get("y") is not None}
        for r in d["reinforcements"]:
            for u in r["units"]:
                if u.get("x") is not None and u.get("y") is not None:
                    mask.add((u["x"], u["y"]))
        tm = terrain.build_map(ch, *need, mask_cells=mask)
        cols, rows = tm["cols"], tm["rows"]
        map_source = "image"
        exact = chr_maps.get(ch)
        if exact and exact.get("grid"):
            grid = exact["grid"]
            if len(grid) == rows and all(len(r) == cols for r in grid):
                tm["map"] = grid
                tm["tileGrid"] = exact.get("groupsGrid")
                tm["stage"] = exact.get("stage", tm["stage"])
                map_source = "chr"
            else:
                print(f"[warn] {ch}: maps-chr 尺寸不符 ({exact.get('cols')}x{exact.get('rows')} vs {cols}x{rows})，回退图像分类")
        if cols < need[0] or rows < need[1]:
            raise SystemExit(f"{ch}: 地图 {cols}x{rows} 放不下坐标 {need}")

        st = story.get(ch, {})
        title = st.get("titleZh") or TITLES[ch]
        summary = st.get("summaryZh") or ""
        brief = st.get("briefZh") or ""
        brief_en = st.get("briefEn") or ""
        obj = (story.get("_objectives") or {}).get(ch, {})

        victory, defeat = conditions(ch, d)
        ally_waves, enemy_waves = [], []
        for r in d["reinforcements"]:
            units = [unit_obj(u) for u in r["units"]]
            units = [u for u in units if u]
            if not units:
                continue
            wave = {"turn": r["turn"], "units": units}
            (ally_waves if r["side"] == "player" else enemy_waves).append(wave)

        allies = [unit_obj(u) for u in d["allies"] if clean_name(u["unit"])]
        enemies = [unit_obj(u) for u in d["enemies"] if clean_name(u["unit"])]
        npcs = [unit_obj(u) for u in d["npc"] if clean_name(u["unit"])]

        bx, by, bw, bh = tm["box"]
        img = tm["image"]

        def js(v):
            return json.dumps(v, ensure_ascii=False)

        lines.append("  {")
        lines.append(f"    id: {js('s' + ch)}, chapter: {i}, title: {js(title)}, titleEn: {js(TITLES_EN[ch])}, titleJa: {js(d['title'])!s},")
        lines.append(f"    stageType: {js(tm['stage'])},")
        lines.append(f"    mapSource: {js(map_source)},")
        lines.append(f"    tileGrid: {js(tm.get('tileGrid'))},")
        lines.append(f"    map: {js(tm['map'])},")
        lines.append(f"    cols: {cols}, rows: {rows},")
        lines.append(f"    bg: {{ x: {bx}, y: {by}, w: {bw}, h: {bh}, imgW: {img['width']}, imgH: {img['height']} }},")
        lines.append(f"    objective: {{")
        lines.append(f"      victory: {js(victory)},")
        lines.append(f"      defeat: {js(defeat)},")
        lines.append(f"      victoryText: {js(obj.get('victoryZh') or '敌全灭')},")
        lines.append(f"      defeatText: {js(obj.get('defeatZh') or '我方全灭')}")
        lines.append(f"    }},")
        lines.append(f"    deploy: {js(allies)},")
        lines.append(f"    enemies: {js(enemies)},")
        lines.append(f"    npcs: {js(npcs)},")
        lines.append(f"    allyWaves: {js(ally_waves)},")
        lines.append(f"    waves: {js(enemy_waves)},")
        lines.append(f"    summary: {js(summary)},")
        lines.append(f"    summaryEn: {js(st.get('summaryEn') or '')},")
        lines.append(f"    brief: {js(brief)},")
        lines.append(f"    briefEn: {js(brief_en)},")
        lines.append(f"    immobile: {js(IMMOBILE.get(ch, []))},")
        lines.append(f"    npcConfig: {js(NPC_CONFIG.get(ch, {}))},")
        lines.append(f"    join: {js(JOIN[ch])},")
        lines.append(f"    joinUnits: {js([s for s in re.split('[、,]', JOIN[ch]) if s and s != '—'])}")
        lines.append("  },")

    lines.append("];")
    lines.append("")
    lines.append("export const SCENARIO_COUNT = SCENARIOS.length;")
    lines.append("")
    lines.append("export function scenarioByIndex(i) {")
    lines.append("  return SCENARIOS[Math.max(0, Math.min(i, SCENARIOS.length - 1))];")
    lines.append("}")
    lines.append("")
    OUT.write_text("\n".join(lines))
    print("wrote", OUT, OUT.stat().st_size, "bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
