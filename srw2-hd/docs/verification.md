# v3.1 验收记录

> 日期：2026-11-09 · 环境：macOS / Python 3.14 / Playwright Chromium / Node 24
> 运行目录：`games/srw2-hd`

## 1. 自动验收

```bash
python3 tests/sweep.py
# ===== 83 passed, 0 failed =====
```

覆盖（v3.0 的 59 项 + v3.1 新增 4 项 + v3.2 新增 2 项 + v3.3 新增 2 项）：

- 26 话逐话加载 + 一回合：无越界、无重叠、无“站墙”、0 console error、0 404；
- 第 2 话增援 6→7、第 5/7/8/11 话 NPC、第 8/17/21/26 话胜负条件；
- 侧栏攻击/精神/待机、移动后 Esc 撤销、存档读档保留 NPC、中英切换、390×844 无溢出；
- `?maps=ai`、BGM 音轨、SDK、胜利→下一话、最终话无“下一话”；
- **26 话 `mapSource:"chr"`**、**19 条 NSF 文件齐全**、**AI 立绘 ≥50 台**、
  **28 章剧情台本加载 + 对话播放**；
- **20 种武器→动作映射**、**战斗动作 Canvas 实际绘制**（v3.2）；
- **侧面战斗立绘已接入（80）**、**cut-in 使用侧面立绘**（v3.3）；
- **未命中闪避/「回避」**、**命中受击/伤害数字**（v3.4）；
- **地图按格重建（26 话 tileGrid）**、**地形 Tile 图集覆盖 26 话**（v3.5）；
- **HD 清图已生成（26 话）**（v3.6）；
- **手绘奇幻 tile 已生成（≥16）**、**默认地图使用手绘 tile**（v3.7）；
- **鼠标悬停不再带动地图**、**攻击后其他单位仍可选中/移动**（v3.8）；
- **骨骼/武器 socket 跟随手部**、**动画状态机/事件顺序**（v3.9）；
- **80 台机体分层素材完整**、**分层素材可逐像素还原原图**（v4.0）。
- 远程动作从枪口/炮口发射（侧面 alpha 最前手 + 枪管）。

## 2. 内容指标

| 项 | 数值 | 证据 |
| --- | --- | --- |
| 地形 | 26 话 / 15,941 格，全部来自 CHR tile | `data/maps-final.json`；`python3 tools/rebuild_maps.py --report` |
| 单位出生格 | 0 个不可通行 | 测试 `[2]` 逐话校验 |
| 立绘 | 80 / 80 sprite key 为 HD（12 原有 + 73 AI） | `config/sprites-generated.js` 的 `AI_HD`；76 条 16×16 像素备用 |
| 剧情 | 28 章 / 2,497 行 / 2,314 句，0 空译 | `data/script-zh.json`；`tools/merge_story_parts.py` |
| 音频 | 19 首 NSF + 3 条原录音，逐话/BOSS/阶段切换 | `assets/audio/nsf/`；`config/audio-tracks.js` |
| 地图来源 | 26/26 `mapSource:"chr"` | `config/scenarios.js` |
| 结构校验 | 所有 JS/Python `--check`/`py_compile` 通过 | `node --check`、`python3 -m py_compile` |

## 3. 截图

| 截图 | 说明 |
| --- | --- |
| [01-title.webp](screenshots/01-title.webp) | 标题页（26 话、中文） |
| [02-ch01.webp](screenshots/02-ch01.webp) | 第 1 话地图 + AI/HD 机体图标 |
| [03-ch26.webp](screenshots/03-ch26.webp) | 第 26 话基地图 |
| [04-story.webp](screenshots/04-story.webp) | 战前剧情对话（布莱特 / 跳过按钮） |
| [05-cutin.webp](screenshots/05-cutin.webp) | 战斗 cut-in（白色要塞 vs 马拉赛，均 HD） |
| [06-beam.webp](screenshots/06-beam.webp) | 光束步枪：枪口→目标光束 + 命中爆闪 |
| [07-saber.webp](screenshots/07-saber.webp) | 光束军刀：月牙斩击 + 火花 |
| [08-map.webp](screenshots/08-map.webp) | 地图兵器：垂直巨炮 + 冲击波 |
| [09-side-beam.webp](screenshots/09-side-beam.webp) | 侧面：高达光束步枪 vs 扎古（面向左） |
| [10-side-rush.webp](screenshots/10-side-rush.webp) | 侧面：近战冲刺 + 速度线 |
| [11-side-punch.webp](screenshots/11-side-punch.webp) | 侧面：魔神Z 火箭飞拳冲锋 |
| [12-windup.webp](screenshots/12-windup.webp) | 前摇：举枪 + 瞄准线 + 准星 |
| [13-dodge.webp](screenshots/13-dodge.webp) | 闪避：目标跳开，光束落空，显示「回避」 |
| [14-hit.webp](screenshots/14-hit.webp) | 命中：受击后仰、爆闪、伤害数字 |
| [15-tilemap.webp](screenshots/15-tilemap.webp) | `?tiles=1` 逐格 tile 拼接地图 |
| [16-clean-map.webp](screenshots/16-clean-map.webp) | `?map=hd` HD 清图：去烘焙人物 |
| [17-fantasy-map.webp](screenshots/17-fantasy-map.webp) | 默认手绘奇幻方形 tile 地图 |
| [18-move-range.webp](screenshots/18-move-range.webp) | 高对比移动范围：青色填充 + 白色外轮廓 |
| [19-skeletal-windup.webp](screenshots/19-skeletal-windup.webp) | 骨骼前摇：手臂抬枪、武器挂载在手掌 |
| [20-skeletal-saber.webp](screenshots/20-skeletal-saber.webp) | 骨骼近战：手臂举刀蓄力 |
| [21-skeletal-impact.webp](screenshots/21-skeletal-impact.webp) | 骨骼攻击：枪口光束 + 命中事件 |
| [22-unit-parts.webp](screenshots/22-unit-parts.webp) | 高达的 8 层分层素材（含底衬） |
| [23-layered-windup.webp](screenshots/23-layered-windup.webp) | 默认分层 cut-in：身体分层 + 支撑臂握枪 |
| [24-layered-fire.webp](screenshots/24-layered-fire.webp) | 分层 cut-in：枪口光束 |
| [25-layered-saber.webp](screenshots/25-layered-saber.webp) | 分层 cut-in：举刀 |
| [26-phase-banner.webp](screenshots/26-phase-banner.webp) | 回合切换中央横幅：我方结束 / 敌方回合 |
| [27-enemy-cutin.webp](screenshots/27-enemy-cutin.webp) | 敌方扎古的热能斧骨骼 cut-in |

## 4. 复现命令

```bash
# 地形（需要原版 ROM 与官方地图）
python3 tools/rebuild_maps.py --report
python3 tools/build_scenarios.py

# NSF 音频（需要自备 NSF；libgme 用 brew 安装）
python3 tools/render_nsf.py --nsf /path/to/srw2.nsf --out assets/audio/nsf

# 剧情（抓取 + 合并已有分块）
python3 tools/scrape_script.py
python3 tools/merge_story_parts.py

# 立绘（需要优云 GPU 网关）
ssh -f -N -L 19100:127.0.0.1:9100 -p 23 root@117.50.187.176
curl -X POST http://127.0.0.1:19100/v1/start -d '{"name":"qwen-image"}'
python3 tools/gen_all_sprites.py --resume
python3 tools/regen_sprites.py --keys argama neelagama racalium midia tros --kind ship
python3 tools/sync_ai_sprites.py

# 全量验收
python3 tests/sweep.py
```

## 5. 未完成 / 已知限制

见 `HANDOFF.md` §7。核心：剧情只有中文；AI 立绘是原创设计；BGM 19 首轮换；
基地图少数混合签名格回退旧配色；`?maps=ai` 底图与地形格不一致。
