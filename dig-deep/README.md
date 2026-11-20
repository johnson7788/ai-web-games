# DIG DEEP

> 挖穿地心 · Drill to the Core

一款原创街机挖掘游戏：在 5 列竖井里点击/滑动选格向下挖掘，用铲子/钻头/激光打破不同硬度的砖块，收集钻石化石回体力，躲开熔岩、跑赢上涨的洪水，一路挖到地心。

## 运行

```bash
cd games/dig-deep
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 选列（横移） | ← → / A D / 拖动 |
| 挖掘 | Space / S / ↓ / 点按 |
| 换工具 | 1 铲子 · 2 钻头 · 3 激光（或点 HUD 工具按钮） |
| 暂停 | Esc / P |

## 玩法

- 格子有硬度，多次点击或换更强工具可秒挖；**障碍岩**只有激光能切。
- **钻石/化石**回体力、记分，化石额外给激光充能。
- 洪水从地表上涨，追到即淹死，必须不停向下挖；**熔岩**碰到重开本层。
- **断层**用铲子挖会塌方砸伤、下方变瓦砾——规划工具选择。
- 12 层深度、三大原创场景包（黄土层 / 化石暗河 / 熔核），挖到地心触发「你挖穿了地球」成就。

## 语言

默认英文，右上角 / 暂停屏下拉可切中文；`?lang=zh` 可临时覆盖，选择持久化。

## 门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

全部 PASS，详见 [docs/report.md](docs/report.md)。
