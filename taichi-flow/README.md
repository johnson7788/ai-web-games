# TAICHI FLOW

> 太极流转 · Swap the neighbours. Balance the board.

霓虹街机气质的阴阳棋盘益智游戏：点一个格子，互换它的左右与上下两对邻居；把每一枚阴格推到发光标记处，调和整块棋盘。锁石挡路、步数争星、连击刷分。

## 运行

```bash
cd taichi-flow
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触控 |
| --- | --- |
| 点格换邻 | 鼠标点击 / 触摸 |
| 撤销 | Z / HUD ↶ |
| 暂停 | Esc / P |
| 重开本关 | R |
| 静音 | M |

## 语言

- 默认 **英文**；标题右上角 / 暂停屏下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage，刷新保留。
- 文案走 `config/locales.js`；en 与 zh 必须完整。

## 测试与门禁

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

## 目录

```
index.html          入口
styles.css          样式
config/             配置与文案（design.json / levels.js / locales.js / sdk.config.js）
src/core/           i18n / sdk / audio
src/game/           sim（纯逻辑）
src/render/         canvas 霓虹渲染
src/ui/             UI 屏幕显隐
src/main.js         主入口（60Hz 装配）
src/vendor/         pipysdk（本地 vendored）
tests/              测试
tools/              工具与验收计划
```

## 调试契约

`window.__ll` 暴露标准调试接口：`state.phase/lang`、`start/pause/resume/restart/home`、`run()`、`tutorial`、`startTutorial`、`debug.autoSolve()`。
