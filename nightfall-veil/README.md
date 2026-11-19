# NIGHTFALL VEIL

> 夜幕降临 · 算式符文从夜幕落下，输入答案、按下「化解」，别让符文越过底部结界。

## 运行

```bash
cd games/nightfall-veil
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 输入数字 | 0–9（物理键盘或屏幕键盘） |
| 退格 | Backspace / ⌫ |
| 化解（提交答案） | Enter / DISPEL |
| 暂停 | Esc / P |
| 重开本关 | R |

## 规则

- 算式（只含 `+`/`-`，中间结果不为负）从顶部落下。
- 输入算式结果，按下「化解」：所有数值匹配的符文同时消散。
- 符文越过底部红色结界线 = 遗漏；遗漏超过关卡上限即失败。
- 撑过本关 60 秒 = 过关，按「零遗漏 / 零误输」评 1–3 星。
- 新增机制：连击加分、星级结算、金色符文（每第 8 题）爆分。

## 语言

- 默认 **英文**；右上角下拉可切 **中文**；`?lang=zh` 可覆盖。
- 文案统一走 `config/locales.js` 的 `t()`。

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
```

## 目录

```
index.html / styles.css   入口 + 霓虹样式
config/                   game.config / levels / locales / design / sdk.config
src/core/                 i18n / sdk / audio
src/vendor/pipysdk.js     本地 SDK（runtimeConfigUrl 已置空，无外链）
src/game/sim.js           纯逻辑（可测）
src/render/index.js       canvas 霓虹渲染
src/ui/ui.js              屏幕显隐 + 语言
src/main.js               装配 + window.__ll 调试契约
tests/                    单测
tools/                    selfplay / audio-check / verify.plan
```

## 调试契约

`window.__ll` 暴露 `{ state:{phase,lang}, start, pause, resume, restart, run, tutorial:{active,step,steps}, startTutorial }`。
