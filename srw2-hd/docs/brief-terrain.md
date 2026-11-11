# M2 执行单：用 CHR tile 精确还原 26 话地形

> 前置：`tools/chrlib.py`、`data/gcgx.json`、`assets/extracted/maps/official-NN.png` 均已存在。
> 只写 `tools/extract_maps_chr.py`、`data/maps-chr.json`、`data/terrain-overrides.json`、`docs/terrain-report.md`。
> **禁止**改 `config/scenarios.js`、`src/*`、`tests/sweep.py`、`tools/chrlib.py`。

## 0. 完成定义
- `python3 tools/extract_maps_chr.py --report` 跑通，输出 26 话的 `data/maps-chr.json`。
- 每话 `grid` 是 `cols×rows` 的地形字符（使用 `config/data.js` 的 LEGEND 字符）。
- 每个官方单位出生格都是可通行地形（pass）。
- 非单位格与旧 `config/scenarios.js` 的地形一致率 ≥ 95%（报告里给出逐话数值）。
- `docs/terrain-report.md` 记录方法、覆盖率、分歧、未解决项。

## 1. 已验证的关键事实
- 官方地图：8px = 1 个 CHR tile，16px = 1 个地图格；地图四周有 8px 装饰边框，用
  `tools/chrlib.content_box(ch)` 得到内容框与 cols/rows。
- **每个 8×8 块都能在 CHR 中唯一匹配到一个 tile id**（`chrlib.build_shape_index`）。
  调色板差异通过 `chrlib.canon` 消除，匹配是精确的。
- 第 1 话 320 格只有 24 种 cell 签名；其中 8 种是连续 4-tile 组（260,264,268,272,276,280,284,288…），
  分别对应地形；其余是单位 sprite（tile id 多在 3300+ / 3584+）或装饰。
- 生态位：`ch01` 的地形组 260=plain、272=desert、276=sea、284=forest、288=desert 变体、264/280=plain 变体。
  **不要盲目按 tile 顺序猜 ID**，用下面的投票 + 人工校对。

## 2. 算法
1. `shape_index = chrlib.build_shape_index()`；对每话用 `chrlib.cell_tile_ids` 取出每格的 4 个 tile id。
2. 读旧 `config/scenarios.js`（用 node 导出 JSON）得到每格旧地形字符；读 `data/gcgx.json` 得到单位坐标集合。
3. 按 4-tile 签名分组：`signature -> {count, label_votes, chapters}`；统计时**排除单位坐标所在的格**。
4. 给每个签名一个地形 key：
   - 初始取 `label_votes` 多数（旧分类只是先验）。
   - 对低票数/冲突/占比大的签名，生成缩略图（4 个 tile 用 CHR 渲染成 32×32 放大图）到
     `/tmp/terrain-groups/`，人工核对；把结论写进 `data/terrain-overrides.json`（`{"<signature>":"forest"}`）。
   - 基地/宇宙/地上三套图不要混；用 `data/gcgx.json[ch].stageType` 限定候选集。
5. 单位格补全：
   - 生成该话「地形 tile id 集合」= 高置信签名用到的 tile id。
   - 对单位格，找与该格非 sprite tile 位置匹配的地形组；找不到就取四邻多数；再不行取该话最常见地形。
6. 校验：
   - 每个单位坐标的字符必须 pass（`wall`/`tank` 不允许）；
   - 非单位格与旧图一致率逐话统计；
   - 每话可通行格比例 > 50%。
7. 输出 JSON：
```json
{
 "01": {
   "cols": 16, "rows": 20, "stage": "ground",
   "grid": ["................", "..."],
   "groups": {"260": "plain", "272": "desert"},
   "stats": {"cells": 320, "unitCells": 19, "agreement": 0.98, "unknown": 0}
 }
}
```
8. `--preview DIR`：给每话生成叠加图（地形 key 上色 + 单位坐标打点），供 Lead 抽查。

## 3. 约束
- 只依赖 Python3 + numpy + PIL；不要联网、不要模拟器。
- 不常驻服务器。
- 字体/中文路径无特殊要求；脚本要能在仓库根目录直接跑。
- 若某话无法达到 95%，不要伪造；在报告里列出并给出原因/建议。

## 4. 验收命令（必须自己跑并贴输出）
```bash
cd /Users/admin/git/webgames/games/srw2-hd
python3 tools/extract_maps_chr.py --report
python3 tools/extract_maps_chr.py --preview /tmp/terrain-preview
node -e "..."   # 校验单位格 pass
```

## 5. 交付格式
1) 文件清单 2) 命令输出 3) 逐话一致率表 4) 未解决项 5) 最不满意的一处
