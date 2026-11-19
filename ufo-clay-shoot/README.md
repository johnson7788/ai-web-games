# UFO CLAY SHOOT

> UFO 黏土射击 · 霓虹街机飞碟靶

## 运行

```bash
cd ufo-clay-shoot
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 桌面 | 移动端 |
| --- | --- | --- |
| 移动 | 方向键 / WASD | 拖拽 |
| 射击 | 空格 | 点击屏幕 |
| 暂停 | Esc / P | — |
| 重开 | R | HUD ↻ |
| 静音 | M | HUD 🔊 |

## 玩法

- 击落黏土飞碟（小/中/大，血量为 1/2/3），躲避敌方弹幕与小行星。
- 收集金币：满 10 枚获得 5s 护盾（无敌）。
- 收集弹药箱：+12 发。
- 三连发道具：8s 内一次三发。
- 连击：连续击落飞碟叠加倍率；漏掉飞碟或死亡则断连。
- 结算按存活时间评 1–3 星；最佳时间持久化。

## 语言

- 默认英文，`?lang=zh` 覆盖；右上角下拉可切换中文。
- `node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .`

## 测试与验收

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```
