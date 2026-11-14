# ESCAPE CHOICE · 抉择逃脱

分支选择逃脱（Henry Stickman / Fleeing the Complex 式）。每个场景给出一组选择，多数通向搞笑失败，少数通向自由。找出全部 4 种逃脱结局（货车 / 河流 / 正门 / 滑索）。火柴人场景全部程序化绘制。

- 品类：剧情 / 冒险（分支选择）
- 参考：Fleeing the Complex / Infiltrating the Airship（只借鉴品类，剧情与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 火柴人场景 + DOM 叙事/选项 · 1280×720 letterbox · 程序化 WebAudio

## 运行

```bash
cd games/escape-choice
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 阅读场景，点选项（或按 `1/2/3`）推进剧情。
- 失败/通关后按 `Enter` 或点「再试一次」回到起点探索其它分支。
- `Esc` / `P` 暂停。

## 规则

- 剧情图 23 个节点：4 个胜利结局 + 8 个搞笑失败 + 中间分支。
- 失败计数与已发现结局跨局保存；找全 4 结局即完美通关。

## 测试与验收

```bash
node --test                                                   # 9 条纯逻辑测试（含剧情图完整性/可达性）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 目录

```
config/      game.config / story（23 节点双语剧情图）/ locales / sdk.config
src/game/    sim.js（纯逻辑：剧情遍历/失败/结局统计）
src/render/  index.js（火柴人场景：牢房/走廊/屋顶/货车/管道等）
src/ui/      ui.js（标题/暂停 + HUD + 叙事/选项 + 结局遮罩 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused；`start/pause/resume/restart`；
`debug.state()` / `debug.choose(i)` / `debug.retry()` / `debug.goto(nodeId)` / `debug.endings()`。

## 国际化

仅 `en`（默认）+ `zh`；全部剧情文本双语。