# SPOT IT · 深夜跳蚤市场找货

> 改造自「找你妹」（按类找物竞速）。玩法规则 1:1 还原「杂乱场景按清单找目标物、点错扣时、限时、关卡递进」，角色/场景/音乐全原创。

## G0 · 立项八问

1. **一句话**：深夜跳蚤市场，玩家靠一盏越照越窄的手电筒，在杂乱货堆里按清单找目标物——点对点亮市场，点错扣时间，点中孪生诱饵双倍扣时。
2. **参考**：找你妹（品类：隐藏物/找茬）。
3. **差异化**：① 手电电量（光圈随时间缩小、找对回充）制造节奏压力；② 真假孪生诱饵（仅一细节差异，点错双倍扣时）；③ 3 场景包换章必换色板构图；④ signature「找齐清单市场灯一盏盏亮起」。
4. **操作**：鼠标/触屏移动扫手电，点击物品拾取；Esc 暂停，触屏同。
5. **一局**：12 关，每关 34–45 秒；超时 = 失败；爽点在第 5–10 秒第一次点中目标回充的瞬间。
6. **成长**：局内连击加分/回充；跨局 best level / best score 存档。
7. **结局**：12 关全清 → 市场点亮（win）；超时 → 灯灭结算卡（fail），一键再来。
8. **乐趣**：掌控（手电影视野的搜索与确认）+ 好奇（孪生细节）。第 3 分钟还在玩因为「下一关更多更小、诱饵更密」。第一个有代价的决定在第 5 秒：先扫大件省电还是先扫小件防遗忘。

**反范围（不做）**：联网/排行榜、皮肤商店、每日任务、剧情对话、竖屏专属模式。

**美术来源**：全程序化 Canvas（3 套场景色板 + 44 种图形组合物品）；BGM/音效 WebAudio 程序化合成，不打包音频文件；封面海报 HTML 叠字截图。

## 运行

```bash
cd games/spot-it
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 手势 |
| --- | --- |
| 扫手电 | 鼠标移动 / 手指滑动 |
| 拾取物品 | 点击 / 点按 |
| 暂停 | Esc |
| 重开（结算屏） | R |

## 语言

默认 **英文**，标题右上角下拉可切 **中文**；`?lang=zh` 可临时覆盖；选择写入 localStorage 刷新保留。

## 测试 / 验收

```bash
node --test                                                        # 纯逻辑（≥26 条）
node tools/selfplay.mjs                                            # 3 策略遥测 → tools/fun/autoplay.json
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root . # Fun Gate
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .  # 设计结构审计
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## 目录

```
index.html / styles.css   入口 + 主题样式
config/                   design.json / items.js / levels.js / gameplay.js / sdk.config.js / locales.js
src/game/                 sim.js（纯逻辑）/ levelgen.js / rng.js
src/render/               index.js（手电合成）/ items.js / scene.js
src/ui/                   screens / hud / tutorial / index
src/core/                 sdk / i18n / save / audio
src/vendor/pipysdk.js     站点 SDK（本地 vendored，runtimeConfigUrl/appConfigUrl 已清空）
tools/                    selfplay / audio-check / record-shots / verify.plan
tests/                    node:test 纯逻辑
```

## 调试契约

`window.__ll`：`state.phase` / `lang()` / `setLang()` / `run` / `start()` / `pause()` / `resume()` / `restart()`(回标题) / `save()` / `ui()` / `tutorial` / `debug.layout()`。
