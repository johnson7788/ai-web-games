# BLOCK BLAST · 方块爆破

霓虹风格的方块填充消除益智游戏。把托盘里的方块拖到 8×8 棋盘上，填满整行或整列即可「爆破」消除得分；一次消多行、连续消除会触发连击加成。无处可放时结算。

- 品类：益智解谜（方块填充 / Block Puzzle）
- 参考：Block Blaster / Block Blast（只借鉴品类，美术与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 2D · 1280×720 letterbox · 程序化 WebAudio

## 运行

```bash
cd games/block-blast
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 鼠标 / 触屏：从右侧托盘**拖拽**方块到棋盘，绿色幽灵预览表示可放，红色表示不可放，松手放置。
- 触屏拖拽时方块自动上移，避免手指遮挡。
- `Esc` / `P` 暂停；窗口失焦自动暂停。

## 规则与计分

- 每放置一格 +1 分。
- 消除 `n` 行/列 = `10 × n × n` 分（多消多得）。
- 连续消除累计连击，额外 `5 × (combo-1)` 分；未消除则连击归零。
- 三块托盘用尽后自动补满；任意一块都放不下时游戏结束。

## 测试与验收

```bash
node --test                                                   # 14 条纯逻辑测试
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
node ../../skills/webgame-playbook/scripts/shot.mjs --root . --out tests/final/desktop.png
```

## 目录

```
config/      game.config / shapes / locales / sdk.config（数值与文案先行）
src/game/    sim.js（纯逻辑：棋盘/托盘/消除/计分，可注入 seed）
src/render/  index.js（霓虹棋盘/拖拽幽灵/爆破粒子）
src/ui/      ui.js（标题/暂停/结算 + HUD + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
src/audio.js 程序化音效
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused|over；`start/pause/resume/restart`；
`debug.state()` / `debug.fit()` / `debug.place(i,r,c)` / `debug.autoPlace()` / `debug.setupLine()`。

## 国际化

仅 `en`（默认）+ `zh`，缺 key 回退 en；语言下拉即时生效、刷新保留、`?lang=` 可覆盖。