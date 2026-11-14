# LETTER PILE · 字母堆

字母堆拼词（Kitty Scramble: Word Stacks 式）。每关给一组字母（堆）与隐藏词表，点字母拼词提交，找全词表过关。12 关，词长 3→5 递增；可重排字母堆、提示揭示首字母。

- 品类：文字 / 益智（字母堆拼词 / 变位词）
- 参考：Kitty Scramble: Word Stacks（只借鉴品类，词库与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 字母堆 + DOM 词表 · 1280×720 letterbox · 程序化 WebAudio

## 运行

```bash
cd games/letter-pile
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 点字母堆里的字母拼词（键盘可直接敲字母），点「提交」校验。
- 「重排」打乱字母堆；「提示」揭示某词首字母（每关 3 次）；「清空」重置选择。
- `Enter` 提交，`Backspace` 撤销，`Esc`/`P` 暂停。

## 规则与计分

- 12 关，每关一组字母 + 词表（全部可由字母拼出）；找到一词 +50。
- 找全词表过关；最佳分存档。

## 测试与验收

```bash
node --test                                                   # 10 条纯逻辑测试（拼词/校验/词表完整性）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 目录

```
config/      game.config（布局/规则）/ levels（12 关）/ locales / sdk.config
src/game/    sim.js（纯逻辑：选字母/提交/提示，可注入 seed）
src/render/  index.js（字母堆/拼词缓冲/反馈）
src/ui/      ui.js（标题/暂停/过关 + HUD + 词表 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused|clear；`start/pause/resume/restart`；
`debug.state()` / `debug.tap(i)` / `debug.submit()` / `debug.shuffle()` / `debug.hint()` / `debug.solveWord(w)` / `debug.solveAll()` / `debug.next()`。

## 国际化

仅 `en`（默认）+ `zh`；界面双语（单词为英文）。