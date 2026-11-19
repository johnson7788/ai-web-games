# CROW BLASTER

> 打乌鸦 · 霓虹街机射击

## 运行

```bash
cd crow-blaster
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 瞄准 | 鼠标移动 / 手指拖拽 / ← → |
| 发射 | 鼠标点击 / 手指松开 / Space |
| 暂停 | Esc / P |
| 重开 | R（结算后） |

## 玩法

用等离子弹弓把飞过霓虹天际线的机械乌鸦打下来：清空每关的乌鸦即可推进。
- **连击**：连续命中乘数翻倍（最高 ×3），脱靶清零。
- **星级**：每关按命中率 1–3 星。
- **金鸦**：命中奖励弹药。
- **装甲乌鸦**：需 3 发。
- **鬼鸦**：误打扣分，别打。

## 语言

- 默认 **英文**；右上角下拉可切 **中文**；`?lang=zh` 可临时覆盖。

## 测试 / 验收

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```
