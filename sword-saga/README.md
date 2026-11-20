# SWORD SAGA · 云隐剑歌

回合制武侠 RPG，12 章水墨短篇。五行相克出招、防御蓄剑意、灵狐替主角挡致命一击。

## 运行

```bash
cd sword-saga
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 桌面 | 触屏 |
| --- | --- | --- |
| 行走 | 方向键 / WASD | 屏幕方向键 |
| 对话推进 | Enter / Space | 点击「下一句」 |
| 战斗 | 鼠标点击菜单 | 触屏点击 |
| 暂停 | Esc | — |

## 语言

默认英文；标题/暂停/设置下拉可切中文。en/zh 全量（`config/locales.js`）。

## 门禁

```bash
node --test                                          # 23 条纯逻辑测试
node tools/selfplay.mjs                              # 3 策略遥测
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

详见 `docs/report.md` 与 `docs/analysis.md`。
