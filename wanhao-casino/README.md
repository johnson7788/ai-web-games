# WANHAO CASINO

> 万豪赌场 · Neon Dice Duel — beat the House

霓虹街机风格的骰子比点游戏：庄家 vs 三门（太阳/月亮/星），下注 → 掷骰 → 发牌 → 比点数 → 结算，8 轮一局。

## 运行

```bash
cd wanhao-casino
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键/操作 |
| --- | --- |
| 下注 | 点击三扇门之一（canvas） |
| 选筹码 | 底部 100/500/1K/5K/10K |
| 开牌 | 底部 ROLL 或键盘 |
| 全押 | 底部 ALL-IN 再点门 |
| 暂停 | Esc / P |
| 重开 | R |
| 静音 | M |

## 规则

- 每手两张牌（1–9），比牌力：双万能牌 > 对子 > 点数（(a+b)%10）；点数大者胜，平局庄家通吃。
- 新增 3 机制：万能牌 Joker（第 2 轮起）、连胜倍率（第 3 轮起，×3 封顶）、多门连击（第 4 轮起）。

## 语言

- 默认英文；右上角下拉可切中文；`?lang=zh` 可覆盖。

## 测试 / 验收

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
node tools/capture.mjs   # 生成 tests/final 截图 + poster.jpg
```
