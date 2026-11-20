# MAHJONG ROOM EN

霓虹麻将房 · Neon Mahjong Room —— 推倒胡麻将 vs 3 个 AI，3 局定星。

## 运行

```bash
cd mahjong-room-en
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 方式 |
| --- | --- |
| 选牌 | 点击手牌（抬起） |
| 出牌 | 点底部 DISCARD |
| 碰 / 杠 / 胡 / 过 | 底部动作条按钮 |
| 幸运换牌 | 能量满 3（碰/杠攒）后点 LUCKY |
| 暂停 | Esc / P |

## 玩法

- 摸牌 → 出牌 → 碰/杠/胡，凑齐 **4 组面子 + 1 对将** 即胡牌。
- 自摸 6 分 / 点炮 1 分；清一色 ×2；连胜加成 ×(连胜+1)。
- 3 局后按总分判定胜负并给 1–3 星。

## 语言

- 默认英文；标题右上角 / 暂停屏下拉可切中文。
- `?lang=zh` 临时覆盖；选择写入 localStorage。

## 自检

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
