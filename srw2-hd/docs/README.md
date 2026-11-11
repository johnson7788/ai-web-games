# srw2-hd 全面改进 · 总计划（Lead 维护）

目标：把 HANDOFF §7 的 4 项遗留问题全部落地，并通过自动验收。
基线：`tests/sweep.py` 63 项全过（2026-11-09）。

## 工作流与文件所有权

| 工作流 | Owner | 产物 | 状态 |
| --- | --- | --- | --- |
| A 地形精确化 | Lead（qoderclicn 探索） | `tools/rebuild_maps.py`, `data/maps-final.json` | ✅ 26 话，15,941 格 |
| B 机体立绘 | Lead（AI 出图） | `tools/gen_all_sprites.py`, `assets/hd/units/*.webp` | ✅ 73 台 AI + 7 张原有 = 80/80 |
| C 剧情台本 | claude × 6 分块 | `data/script-zh.json`（28 章 / 2,497 行） | ✅ 0 空行 |
| D 音频 | Lead | `tools/render_nsf.py`, `assets/audio/nsf/*.mp3` | ✅ 19 首 |
| 集成/验收 | Lead | `config/scenarios.js`(生成), `config/units.js`, `src/main.js`, `tests/sweep.py`, `HANDOFF.md` | ✅ 63/63 |

**硬规则**
- 子 agent 只写自己名下的文件；`config/scenarios.js` 是生成物，任何人不得手改。
- 不改 `tests/sweep.py`（Lead 的验收脚本）。
- 不常驻起服务器；脚本跑完即退出。
- 交付必须附：文件清单、运行命令、真实输出、未做项。

## 关键技术结论（已验证）
- 官方地图 8×8 块与 CHR tile **逐一精确匹配**；图片有 1px 漂移，`chrlib.cell_tile_ids`
  做了逐格 ±1 像素搜索，ch02 覆盖率从 6% 提到 92%。
- 地形分组→地形的**人工校对表**解决了「橙色山被旧分类判成沙漠」的系统性错误。
- ROM 是 mapper 74；jsnes 不支持，Mesen2/FCEUX 支持（备用路线）。
- NSF 19 首，`tools/render_nsf.py` 用 libgme 渲染，首尾交叉淡化循环。
- 台本源：adventureisland.org `kw0..kw27`，Shift_JIS，28 章 2,497 行。
- AI 立绘：优云 qwen-image，1024 生成 → 白底 flood fill → 256 RGBA → WebP。

## 里程碑
- M1 音频 ✅ 19 条 NSF + 逐话 BGM + BOSS 曲 + 阶段切换。
- M2 地形 ✅ CHR 精确提取 + 人工校对 + 单位格推断。
- M3 剧情 ✅ 28 章全量中文台本，对话播放 + 跳过。
- M4 立绘 ✅ 73 台 AI 立绘 + 7 张原有，`AI_HD` 已接入。
- M5 集成验收 ✅ 83 项测试、截图、文档、HANDOFF。
