# TOP ANSWER · 大众答案

大众答案排行竞猜（Family Feud 式）。每回合一个调查问题，答案按热度赋分并隐藏；输入猜测揭示热门答案，找全榜单过关。10 回合，支持英文/中文答案与常见别名。

- 品类：问答 /  trivia（大众答案排行）
- 参考：Guess Their Answer / Family Feud（只借鉴品类，题库与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 背景 + DOM 答案板/输入 · 1280×720 letterbox · 程序化 WebAudio

## 运行

```bash
cd games/top-answer
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 在输入框输入答案，按 `Enter` 或点 `Guess` 提交。
- `Hint`：揭示某个未找到答案的首字母（每回合 3 次）。
- `Reveal`：直接揭示剩余答案（不得分）并结束回合。
- `Esc` / `P` 暂停（输入框聚焦时不触发，避免误暂停）。

## 规则与计分

- 每个答案按热度赋分（合计约 100）；猜中即得该分。
- 匹配大小写/空格不敏感，接受英文别名（如 mozzarella→Cheese）与中文（如 芝士）。
- 找全所有答案过关；总分跨回合累计，最佳分存档。

## 测试与验收

```bash
node --test                                                   # 12 条纯逻辑测试（双语匹配/别名/回合）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 目录

```
config/      game.config / questions（10 题双语题库）/ locales / sdk.config
src/game/    sim.js（纯逻辑：双语匹配/提示/揭示/计分，可注入 seed）
src/render/  index.js（背景渐变 + 彩带粒子）
src/ui/      ui.js（标题/暂停/过关 + HUD + DOM 答案板/输入 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused|clear；`start/pause/resume/restart`；
`debug.state()` / `debug.guess(text)` / `debug.hint()` / `debug.reveal()` / `debug.solveRound()` / `debug.setRound(n)`。

## 国际化

仅 `en`（默认）+ `zh`；题干与答案双语，玩家可用英文或中文作答。