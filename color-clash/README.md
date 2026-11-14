# COLOR CLASH · 颜色大战

UNO 式出牌卡牌游戏（Four Colors / Foono 式）。匹配顶牌的颜色或数字出牌，功能牌跳过/反转/罚摸，万能牌指定颜色；率先出完手牌者获胜。玩家对战 2 个 AI。

- 品类：棋牌 / 卡牌（UNO 式）
- 参考：Four Colors / Foono（只借鉴品类，规则实现与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 牌桌 + DOM 选色器 · 1280×720 letterbox · 程序化 WebAudio

## 运行

```bash
cd games/color-clash
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 你的回合：点**发光**的手牌出牌；点摸牌堆摸牌；万能牌弹出选色器。
- 摸到可出的牌后可出可过（「摸牌✓」按钮过牌）。
- `Esc` / `P` 暂停。AI 回合自动进行。

## 规则

- 标准 108 张牌：四色 0–9 + 跳过/反转/+2，各 4 张万能/+4。每人 7 张。
- 匹配颜色或数字出牌；跳过跳过下家、反转转向、+2/+4 罚摸并跳过。
- 先出完手牌获胜；胜/负场存档。

## 测试与验收

```bash
node --test                                                   # 12 条纯逻辑测试（含整局模拟无死循环）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 目录

```
config/      game.config（颜色/布局/规则）/ locales / sdk.config
src/game/    sim.js（纯逻辑：牌局/匹配/功能牌/AI，可注入 seed）
src/render/  index.js（牌桌/手牌/牌堆/当前色/可出高亮）
src/ui/      ui.js（标题/暂停/结算 + HUD + 选色器 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused|over；`start/pause/resume/restart`；
`debug.state()` / `debug.legal()` / `debug.play(i,color)` / `debug.draw()` / `debug.pass()` / `debug.ai()` / `debug.runAI()` / `debug.forceWin()`。

## 国际化

仅 `en`（默认）+ `zh`；界面双语（牌面为通用数字/符号）。