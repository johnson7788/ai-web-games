# CHESS MASTER · 国际象棋

完整棋规的国际象棋，玩家执白对战 AI（negamax + alpha-beta 剪枝，深度 3，子力+位置评估）。支持王车易位、吃过路兵、升变、将军/将杀/逼和判定；合法走法提示、上一步高亮、悔棋。

- 品类：棋牌 / 策略（国际象棋 AI）
- 参考：Chess Free / Chess Online（只借鉴品类，引擎与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 棋盘 + DOM 侧栏 · 1280×720 letterbox · 程序化 WebAudio

## 运行

```bash
cd games/chess-master
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 点选己方棋子 → 显示合法走法（绿点空格 / 红圈吃子）→ 点目标格走子。
- 兵到底线弹出升变选择（后/车/象/马）。
- `U` 或「悔棋」按钮撤销（回到你的回合）；「新对局」重开。
- `Esc` / `P` 暂停。AI 自动应着。

## 规则与 AI

- 完整棋规：王车易位（含经过格不被将军校验）、吃过路兵、升变、将杀/逼和/50 步和棋。
- AI：negamax + alpha-beta，深度 3，子力价值 + 兵/马位置表，约 100ms/步。

## 测试与验收

```bash
node --test                                                   # 11 条引擎测试（将杀/逼和/易位/过路兵/升变/AI）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 目录

```
config/      game.config（布局/子力价值/AI 深度）/ locales / sdk.config
src/game/    chess.js（引擎：棋规/将军/AI）+ sim.js（对局管理/悔棋/吃子）
src/render/  index.js（棋盘/棋子/高亮）
src/ui/      ui.js（标题/暂停/结算 + 侧栏 + 升变选择 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused|over；`start/pause/resume/restart`；
`debug.state()` / `debug.legal()` / `debug.move(fr,fc,tr,tc,promo)` / `debug.ai()` / `debug.select(r,c)` / `debug.undo()` / `debug.newGame()`。

## 国际化

仅 `en`（默认）+ `zh`；界面双语（棋子为通用符号）。