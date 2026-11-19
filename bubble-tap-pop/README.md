# BUBBLE TAP POP

> 霓虹泡泡点 · 斯特鲁普颜色点击街机

## 玩法

目标词显示在顶部（如「RED」），屏上 5 个泡泡分别是一种真实颜色，但每个泡泡上印着**另一个颜色词**（干扰）。
你要**点中真实颜色与目标词一致的那个泡泡**，无视泡泡上印的字。

- 点对：+1 分，连击累积（每 5 连击得分翻一档，单次最高 +5）。
- 点错 / 超时（3 秒一轮）：扣 1 命、断连击。
- 分数 ≥8 进入 L2：每 3 轮出现一个**灰色岩石陷阱**，它写着颜色词诱导误点，点它扣命断连击。
- 3 条命耗尽结算：按分数给 1–3 星；分数越高每轮时限越短（节奏加快）。

## 运行

```bash
cd games/bubble-tap-pop
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触摸 |
| --- | --- |
| 点泡泡 | 鼠标 / 触摸 |
| 暂停 / 继续 | Esc / P |
| 重开 | R |
| 静音 | M |

## 语言

- 默认 **英文**；标题右上角 / 暂停屏下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage，刷新保留。
- 所有可见文案走 `config/locales.js`；en 与 zh 完整。

## 测试与门禁

```bash
node --test
node tools/selfplay.mjs
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
```

## 目录

```
index.html          入口
styles.css          样式
config/             数值 / 文案 / 设计源 / SDK 配置
src/core/           i18n / sdk / audio
src/game/sim.js     纯逻辑（零 DOM，可单测 / selfplay）
src/render/         霓虹街机 canvas 渲染
src/ui/             UI 薄适配
src/main.js         主入口（60Hz 固定步长）
src/vendor/         本地 SDK 桩
tests/              单测
tools/              自对弈 / 音频验收 / 验收计划 / 海报
```

## 调试契约

`window.__ll` 暴露：`state.phase/lang`、`start/pause/resume/restart`、`run`、`tutorial`、
`startTutorial`、`save`、`debug`（`tapCorrect/tapWrong/hasRock/giveUp/forceScore/setTutorialDone`）。
