# BRAIN CHICKEN RUN

霓虹街机风「判断力大逃杀」：每局 20 只霓虹鸡（你 + 19 只机器人）分成 **TRUE / FALSE** 两条车道，
每题一个判断对错的陈述，限时内站到正确车道；计时结束清场闸门/岩石扫过错误车道，站错的全灭。
连对 3 题得护盾（可挡一次出局），金题双倍分，撑满 3 关 12 题即「吃鸡」。

## 运行

```bash
cd brain-chicken-run
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 选择 TRUE | 点击左按钮 / `1` / `←` |
| 选择 FALSE | 点击右按钮 / `2` / `→` |
| 暂停 / 继续 | `Esc` / `P` |
| 结算后再来一局 | `R` |

## 语言

- 默认 **英文**；`?lang=zh` 覆盖；下拉可切 **中文**，选择写入 localStorage 保留。
- `?lang=` 临时覆盖优先于 localStorage。
- 所有可见文案走 `config/locales.js` 的 `t()`；en 与 zh 完整。

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
