# PICWORDS · 看图拼词

看图拼词（Crocword / 4 Pics 1 Word 式）。看 emoji 图与提示，从字母块中拼出对应单词。16 关（apple→rainbow），词长递增；每关 3 次提示揭示字母。无计时，纯放松。

- 品类：文字 / 益智（看图拼词）
- 参考：Crocword（只借鉴品类，图库与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 图/槽/字母块 + DOM 提示 · 1280×720 letterbox · 程序化 WebAudio

## 运行

```bash
cd games/picwords
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 点字母块填入答案槽；点已填槽移除字母。
- `H`/「提示」揭示一个字母（每关 3 次）；「清空」重置；`Backspace` 撤销最后一字母。
- `Esc`/`P` 暂停。

## 规则与计分

- 16 幅图，每图一个英文单词；字母块 = 单词字母 + 3 个干扰字母。
- 拼对 +100 分；最佳分存档。

## 测试与验收

```bash
node --test                                                   # 10 条纯逻辑测试（填槽/校验/提示/字母多重集）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 目录

```
config/      game.config（规则/配色）/ pictures（16 图）/ locales / sdk.config
src/game/    sim.js（纯逻辑：填槽/校验/提示，可注入 seed）
src/render/  index.js（emoji 图/答案槽/字母块/反馈）
src/ui/      ui.js（标题/暂停/完成 + HUD + 提示 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused|clear；`start/pause/resume/restart`；
`debug.state()` / `debug.tapTile(i)` / `debug.tapSlot(i)` / `debug.hint()` / `debug.solve()` / `debug.next()`。

## 国际化

仅 `en`（默认）+ `zh`；提示双语（单词为英文）。