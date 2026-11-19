# GUN GOD ARENA

> 枪神竞技场 · 霓虹弹射靶场

## 运行

```bash
cd gun-god-arena
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 桌面 | 移动端 |
| --- | --- | --- |
| 瞄准 | 拖拽 / 方向键 | 拖拽 |
| 射击 | 松开拖拽 / 空格 | 松开拖拽 |
| 暂停 | Esc / P | — |
| 重开 | R | HUD ↻ |
| 静音 | M | HUD 🔊 |

## 玩法

- 拖拽瞄准炮台，松手发射会反弹的子弹（撞墙 / 撞箱反弹，最多 8 次）。
- 击碎所有琥珀色全息靶即可过关；子弹有限，用弹越少星级越高。
- 绿色 VIP 目标绝对不能打，误伤立即失败。
- 打爆道具箱掉增益：+2 弹药 / 三连发 / +500 分 / 炸弹。
- 打中岩石可使其坠落，碾压下方全息靶（免费击杀）。
- 连击：连续击碎全息靶叠加倍率计分。

## 语言

- 默认英文，`?lang=zh` 覆盖；右上角下拉可切换中文。
- `node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .`

## 测试与验收

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```
