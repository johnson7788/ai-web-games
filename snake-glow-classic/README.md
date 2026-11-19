# SNAKE GLOW CLASSIC · 霓虹贪吃蛇

> 霓虹街机 · 120 秒经典贪吃蛇局。在发光的网格上操控一条霓虹蛇，吃掉光球变长、追连击、绕岩石，用冲刺抢节奏，活到最后。

## 运行

```bash
cd games/snake-glow-classic
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键鼠 | 触屏 |
| --- | --- | --- |
| 转向 | 方向键 / WASD | 滑动 |
| 冲刺 | Space / Shift（长按） | 长按 ⚡ 按钮 |
| 暂停 | Esc | — |
| 重开 | R | — |
| 静音 | M | 🔊 按钮 |

## 玩法（120 秒三阶段）

- **第 1 段（0–40s）**：吃光球变长得分；连续快吃触发连击倍率。
- **第 2 段（40–80s）**：霓虹岩石出现，撞上即死；冲刺已解锁。
- **第 3 段（80–120s）**：金色球（5 倍分 + 多长 1 节）+ 提速 + 更多岩石。

死亡（撞墙 / 咬到自己 / 撞岩石）即结束；活满 120 秒胜利，按分数结算 1–3 星。

## 语言

- 默认英文；标题右上角 / 暂停屏可切中文；`?lang=zh` 临时覆盖。
- 文案全部走 `config/locales.js`；`i18n-check` 保证 en/zh key 完整一致。

## 测试 / 门禁

```bash
node --test
node tools/selfplay.mjs
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
```

## 调试契约

`window.__ll`：`state.phase` / `start()` / `pause()` / `resume()` / `restart()` / `run` / `tutorial.{active,step,steps}`；`debug.{state,startSeeded,fastForward,jump,forceWin,forceLose}`。
