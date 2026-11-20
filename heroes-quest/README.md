# HEROES QUEST · 英雄远征

> 回合制战术远征 RPG：率三英雄走 12 节点分支远征地图，战前布阵、行军耗粮、速度条回合战斗，积攒「远征军势」三英合击。

## 运行

```bash
cd games/heroes-quest
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态，无运行期依赖（唯一例外站点 SDK，可降级）。

## 操作

| 动作 | 键鼠 | 触屏 |
| --- | --- | --- |
| 开始/重开 | Enter / R | 点按钮 |
| 行军 | 点击发光节点 | 同 |
| 布阵 | 点英雄 → 点阵位 → 确认 | 同 |
| 战斗 | 点技能 → 点目标（敌=攻击 / 友=治疗） | 同 |
| 军势合击 | 军势满时点「远征军势」 | 同 |
| 暂停 | Esc / P | — |

## 语言

默认英文；标题右上角下拉切中文；`?lang=zh` 可临时覆盖，选择写入 localStorage 刷新保留。所有文案走 `config/locales.js`（en/zh 完整才暴露）。

## 门禁（全绿）

```bash
node --test                                              # 27 条纯逻辑
node tools/selfplay.mjs                                  # 3 策略遥测
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .     # ≥WARN
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .      # ≥WARN
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

完整报告见 `docs/report.md`，源码分析见 `docs/analysis.md`。

## 目录

```
config/   设计源(design.json) / 玩法数值 / 12 节点地图 / 文案 / SDK 配置
src/game/ 纯逻辑（远征状态机 + 速度条战斗）
src/render/ 程序化三场景包 + 地图/战斗渲染
src/ui/   DOM 屏幕 / HUD / 布阵 / 战斗指令条 / 教程
src/core/ i18n / 程序化音频 / SDK 出口
tests/    node:test 纯逻辑
tools/    自玩遥测 / 音频校验 / 截图 / 录 gif / 海报
```
