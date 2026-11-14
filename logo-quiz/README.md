# LOGO QUIZ · Logo 猜猜

看图标猜品牌（Logo Quiz 式）。出现一个品牌图标（叶/火箭/火焰/星等），从 4 个选项中选出匹配的品牌名。12 回合，全部为**原创虚构品牌**（Greenleaf/Redrocket/Flamegrill…），不含真实商标。

- 品类：问答 / 益智（图标竞猜）
- 参考：Logo Quiz: Game World Trivia（只借鉴品类；为避免商标问题采用原创虚构品牌）
- 技术：零构建纯静态 · ES Module · Canvas 徽标 + DOM 选项 · 1280×720 letterbox · 程序化 WebAudio

## 运行

```bash
cd games/logo-quiz
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 点选项（或按 `1-4`）作答；答后自动进入下一回合。
- `Esc`/`P` 暂停。

## 规则与计分

- 16 个原创品牌，每回合随机取 1 个图标 + 4 选项（1 正确 + 3 干扰）。
- 答对 +100；12 回合后结算；最佳分存档。

## 测试与验收

```bash
node --test                                                   # 9 条纯逻辑测试（选项/计分/品牌库完整性）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 目录

```
config/      game.config（规则）/ brands（16 原创品牌）/ locales / sdk.config
src/game/    sim.js（纯逻辑：出题/选项/计分，可注入 seed）
src/render/  index.js（16 种程序化品牌图标 + 对错闪光）
src/ui/      ui.js（标题/暂停/完成 + HUD + 选项 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused|done；`start/pause/resume/restart`；
`debug.state()` / `debug.answer(i)` / `debug.answerCorrect()` / `debug.next()` / `debug.playAll()`。

## 国际化

仅 `en`（默认）+ `zh`；界面双语（品牌名为原创英文）。