# M4 执行单：从 CHR + 官方地图提取原版机体图标

> 前置：`tools/chrlib.py`、`data/unit-sprite-map.json`、`data/gcgx.json` 已存在。
> 只写 `tools/extract_sprites_chr.py`、`assets/hd/units-gen/*`、`data/sprites-chr.json`、`docs/sprites-report.md`。
> **禁止**改 `config/units.js`、`config/scenarios.js`、`src/*`、`tests/sweep.py`、`tools/chrlib.py`。

## 0. 完成定义
- `python3 tools/extract_sprites_chr.py --report` 跑通。
- 对 `data/unit-sprite-map.json` 里每个 **sprite key**（去重后约 48 个，不含已有 12 个 HD 立绘）
  尽量产出 `assets/hd/units-gen/<sprite>.png`（16×16 RGBA）和 `<sprite>@8x.png`（128×128，nearest）。
- `data/sprites-chr.json` 记录：sprite key、来源话数/坐标、palette、覆盖状态（full/partial/missing）。
- `assets/hd/units-gen/_sheet.png` 一张总览图。
- 成功率 ≥ 70% 的 sprite key；失败项在报告里列原因。

## 1. 已验证的关键事实
- 官方地图是原生机体 sprite + 背景 tile 的合成；单位坐标已知（`chrlib.unit_positions(ch)`）。
- 每个 8×8 块都能精确匹配到 CHR tile（`chrlib`）。
- 地图图块的调色板可以从像素颜色反推：CHR 的 2bpp 索引 0=透明，1/2/3=三种颜色；
  对每个 sprite tile，采样图中对应索引的像素颜色即可得到 palette。
- 机体通常占 1 个 16×16 格；BOSS 可能 32×32（P1，可后做）。

## 2. 算法
1. 用 terrain agent 的成果/或自己按「高计数 4-tile 组」估计每话的地形 tile id 集合
   （若 `data/maps-chr.json` 已存在则直接读；否则用 `tools/terrain.py` 的地形先验）。
2. 对每个单位坐标：
   - 取 4 个 tile id；把属于地形 tile 集合的块视为背景，其余为 sprite。
   - 若 4 块全是地形 → 该单位不在此格（跳过）。
   - 对每个 sprite tile：解码 2bpp；对索引 1..3 在图中采样颜色；索引 0 透明；拼成 16×16 RGBA。
   - 若某索引在图中找不到（被裁掉），用同单位其它 tile 的 palette 兜底。
3. 同一 sprite key 多次出现时选质量最好的：
   - sprite tile 数多、覆盖邻居单位少、背景为 plain 的优先；
   - 记录 chapter/x/y。
4. 输出 16×16 与 8× nearest 128×128；保留 alpha；不要覆盖 `assets/hd/units/*.webp`。
5. 生成 `_sheet.png`：每行 8 个，标注 sprite key 和状态。

## 3. 约束
- 只依赖 Python3 + numpy + PIL；不联网、不模拟器。
- 不常驻服务器。
- 不要伪造：提取不出来的写 missing，不要用其它机体顶替。

## 4. 验收命令
```bash
cd /Users/admin/git/webgames/games/srw2-hd
python3 tools/extract_sprites_chr.py --report
ls assets/hd/units-gen | head
python3 - <<'PY'  # 检查 alpha 非空、尺寸
...
PY
```

## 5. 交付格式
1) 文件清单 2) 命令输出 3) 成功/失败表 4) 未做项 5) 最不满意的一处
