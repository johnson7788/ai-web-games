# EARN 100 MILLION · 挣他一个亿

> 从 20 岁打工人起步，倒卖霓虹商品、创办公司持股分红、买房买车，一路把净资产滚到 **1 亿**。

## 运行

```bash
cd earn-100-million
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 方式 |
| --- | --- |
| 买入商品 | 市场面板「Buy 1 / Buy 10」 |
| 卖出商品 | 仓库面板「Sell 1 / Sell all」 |
| 创办公司 / 买卖股票 | 商业面板 |
| 买房 / 买车 / 就医 / 赌博 | 生活面板 |
| 约会 / 结婚 | 恋爱面板 |
| 推进一年 | 右下角「NEXT YEAR」或空格键 |
| 暂停 / 重开 | Esc / R |

## 玩法

- 每年市场刷新 5 件商品报价（低价红 / 中价黄 / 高价绿）。**低买高卖**，连续盈利积攒 **FLOW 连击**，放大下一笔卖出收益。
- **牛熊市**周期影响商品与股价漂移。
- 创办公司拿分红、买房买车攒名声与健康；随机事件二选一；资产破 1 亿即获胜。
- 结算按净资产/婚姻给 **1–5 星**评级，并发放可继承的**技能点**（天赋树跨局成长）。

## 语言

默认英文；右上角下拉可切中文；`?lang=zh` 覆盖并记忆。

## 测试 / 门禁

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

## 调试契约

`window.__ll` 暴露 `{ state:{phase,lang}, start, pause, resume, restart, run, tutorial:{active,step,steps}, startTutorial, debug }`。
