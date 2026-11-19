# SKY STRIKE 1942

> 天袭 1942 · 霓虹街机竖版射击

## 运行

```bash
cd sky-strike-1942
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触控 |
| --- | --- |
| 驾驶战机 | 拖拽 / 指针拖动（桌面也可 A/D/W/S 或方向键） |
| 暂停 / 继续 | P 或 Esc |
| 重新开始 | R |
| 静音 | M |

机炮自动开火：对齐敌机打出连击（combo），躲避岩石与敌弹，拾取 散射/护盾/炸弹 道具，撑过三波空袭。

## 语言

- 默认 **英文**；标题右上角 / 暂停屏下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage（`sky-strike-1942-lang`），刷新保留。
- 所有可见文案走 `config/locales.js` 的 `t()`；en 与 zh 完整对齐。

## 门禁自检

```bash
node --test                                   # 单测
node tools/selfplay.mjs                       # 机器人遥测 → tools/fun/autoplay.json
node tools/audio-check.mjs                    # 音频离屏复验
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
```
