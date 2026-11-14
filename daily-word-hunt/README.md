# DAILY WORD HUNT · 每日找词

每日一款的词搜（Word Search）益智游戏。12×12 字母网格中藏有 8 个主题单词（横/竖/斜、正/反），沿直线拖动字母圈出单词，找全过关。每天同一题（按日期 seeded），也可随机新题。

- 品类：文字词汇 / 益智（网格找词 + 每日一题）
- 参考：Daily Word Search（只借鉴品类，词库与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 2D · 1280×720 letterbox · 程序化 WebAudio

## 运行

```bash
cd games/daily-word-hunt
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 鼠标 / 触屏：在网格上**按住一个字母并沿直线拖动**，荧光笔跟随，松手圈词。命中隐藏词即标金划掉。
- `Hint`：闪烁某个未找到词的首字母（每题 3 次）。
- `Play Today` 今日题 / `New Puzzle` 随机题。
- `Esc` / `P` 暂停；窗口失焦自动暂停。

## 规则与计分

- 8 大主题（动物/美食/太空/海洋/运动/音乐/自然/色彩），每主题 10 词随机取 8。
- 每词 +100，连续找到额外 `10 × (streak-1)` 连击奖励。
- 每日题按日期生成，全球同题；最佳分存档。

## 测试与验收

```bash
node --test                                                   # 12 条纯逻辑测试（含生成正确性/直线吸附）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 目录

```
config/      game.config / themes（8 主题词库）/ locales / sdk.config
src/game/    sim.js（纯逻辑：seeded 网格生成/直线选词/提示，可注入 seed）
src/render/  index.js（字母网格/荧光笔划线/词表/粒子）
src/ui/      ui.js（标题/暂停/过关 + HUD + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused|clear；`start/pause/resume/restart`；
`debug.state()` / `debug.select(cells)` / `debug.solveWord(i)` / `debug.solveAll()` / `debug.hint()` / `debug.setSeed(n)`。

## 国际化

仅 `en`（默认）+ `zh`；词库为英文单词（玩法本体），界面与主题名双语。