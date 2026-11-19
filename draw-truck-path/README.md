# DRAW TRUCK PATH

> 划线卡车 — 霓虹街机风的徒手画路 + 驾驶解谜。

## 运行

```bash
cd draw-truck-path
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 |
| --- | --- |
| 画路（拖动画线） | 鼠标 / 手指 |
| 向左开 | A / ← |
| 向右开 | D / → |
| 自动发车（开关） | Space |
| 暂停 | Esc / P |
| 重开本关 | R |
| 静音 | M |

## 玩法

1. 在左右两座平台之间的缺口上拖动画出公路（每笔消耗一格墨）。
2. 按住 ▶（或等首笔完成后的自动发车）让卡车沿路行驶。
3. 把卡车开到右侧绿色平台即可送达核心；掉进火池、擦到火花束或倒计时归零都会失败。
4. 火花束（竖条）必须绕行；能量核心（发光球）穿过即可收集。用笔越少、核心全收，星越多。

## 语言

- 默认 **英文**；标题/暂停屏下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage，刷新后保留。

## 测试 / 门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node tools/scene-shots.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 目录

```
index.html          入口
styles.css          霓虹街机风样式
config/             配置与文案（design.json = 机器可读设计源）
src/core/           i18n / audio / sdk
src/game/sim.js     纯逻辑（可 Node 直跑）
src/render/         Canvas 程序化渲染
src/ui/             UI
src/main.js         主入口（60Hz 固定步长）
src/vendor/pipysdk.js  本地 vendored SDK（无外链）
tests/              测试
tools/              工具与验收计划
```

## 调试契约

`window.__ll` 暴露标准调试接口：`state.phase/lang`、`start/pause/resume/restart/home`、
`tutorial`（active/step/steps）、`startTutorial`，以及 `debug.state/loadLevel/autoSolve/fastForward/drawPath`。
