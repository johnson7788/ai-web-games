# QUIZ SPRINT

> 答题冲刺 —— 知识马拉松：答对冲刺、连击加速，5 连对触发「学霸冲刺」残影；每 5 题一次双倍赌注题，先看类别再决定答或跳过；体力条决定容错节奏。三场景包（晨跑/山道/夜城），12 赛推进。

改造自联机竞速答题《答题冲冲》（Cocos 源码），玩法规则 1:1 还原核心循环，单机化 + 原创改造：角色/场景/题库/音乐全原创。

## 运行

```bash
cd quiz-sprint
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态 + 零运行期依赖；断网可玩（站点 SDK 自动降级）。

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 选择答案 | 点击 4 个选项之一（桌面也可按 1/2/3/4） |
| 赌注题跳过 | 点击 Skip（安全小步） |
| 暂停 | Esc / P |
| 结算后再赛 | R |

## 语言

- 默认 **英文**；右上角下拉 / 暂停屏可切 **中文**；`?lang=zh` 临时覆盖，选择写入 localStorage 刷新保留。
- 只暴露 en/zh（完整才暴露）；题库 en/zh 各 128 题。

## 测试

```bash
node --test
```

## 全套门禁（游戏根目录执行）

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

## 目录

```
index.html           入口
styles.css           样式
poster.jpg           封面（1280×720）
game.gif             列表页动图（480×270）
config/              game.config / gameplay / levels / quiz / locales / design / sdk.config
src/core/            i18n / save / audio / sdk
src/game/            sim（纯逻辑）/ quiz（抽题）/ rng
src/render/          三场景包 + 赛道 + 跑者 + 粒子
src/ui/              标题/暂停/结算/设置/HUD/题目面板/教程
src/vendor/          pipysdk（vendored）
src/main.js          装配 / 固定步长 / 状态机 / 调试契约
tests/               node:test 纯逻辑（30 条）
tools/               selfplay / verify.plan / audio-check / record-gif / poster / shot-final
docs/                analysis / report / short / long
```

## 调试契约

`window.__ll` 暴露：`state.phase`（boot/title/playing/paused/finished）、`lang`、`setLang`、`run`、`start`、`pause`、`resume`、`restart`（回标题）、`save`、`ui`、`tutorial`（active/step/steps/current/skip）、`debug.layout()`。
