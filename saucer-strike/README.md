# SAUCER STRIKE

复古雷达站守卫战：拖磁轨炮蓄力瞄准、松开发射，拦截 12 波 UFO。命中按碟计分、漏碟扣命；满蓄过热锁炮；曳光弹显形隐形碟。

## 运行

```bash
cd games/saucer-strike
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 操作 |
| --- | --- |
| 瞄准蓄力 | 按住拖动（鼠标 / 触屏） |
| 发射 | 松开 |
| 曳光弹 | Q / T / 触屏右下按钮 |
| 暂停 | Esc |
| 重开 | R |

## 语言

默认英文，右上角下拉可切中文；`?lang=zh` 可临时覆盖，选择刷新保留。

## 验收

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

详见 `docs/report.md`。
