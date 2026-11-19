# DRIFT KING CN

> 漂移王者 · 霓虹漂移无尽竞速

程序化 canvas 霓虹漂移赛车：自动前进 + 左右转向漂移，收集星星为氮气充能，主动狂暴撞翻对手，靠连击刷分。桌面 + 移动端，零依赖零外链。

## 运行

```bash
cd drift-king-cn
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 左转 | ← / A / 左半屏 |
| 右转 | → / D / 右半屏 |
| 氮气（狂暴） | Space / BOOST 按钮 |
| 暂停 | Esc / P / 暂停按钮 |
| 重开 | R |
| 静音 | M |

## 语言

- 默认英文；标题右上角 / 暂停屏下拉可切中文。
- `?lang=zh` 临时覆盖；选择写入 localStorage。
- 所有文案走 `config/locales.js`；en 与 zh 完整。

## 测试 / 验收

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 调试契约

`window.__ll` 暴露：`state.phase/lang`、`start/pause/resume/restart/home`、`run`、`tutorial`（active/step/steps/current）、`startTutorial`、`debug`（forceHit/forceCombo/die/mode/state）。

## 目录

```
index.html        入口
styles.css        样式
config/           数值/文案/设计源/SDK 配置
src/core/         i18n / SDK / 音频
src/game/sim.js   纯逻辑
src/render/       canvas 渲染
src/ui/           UI
src/main.js       主入口
tests/            单元测试
tools/            验收计划 / 自对弈 / 音频验收
```
