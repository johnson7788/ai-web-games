# STICKMAN ESCAPE ROOM

> 火柴人密室逃脱 — 在霓虹天花板压扁你之前，站进发光的安全缺口，逃出 8 间密室。

## 运行

```bash
cd stickman-escape-room
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 左移 | ◀ 按钮 / ← 或 A |
| 右移 | ▶ 按钮 / → 或 D |
| 冲刺（跳两列） | 双击 ◀/▶ 或 Shift+方向键 |
| 暂停 | Esc / P |
| 重开 | R |
| 静音 | M |

## 玩法

- 每间密室有 9 根柱子，天花板会带着尖刺下落。
- 天花板上的**发光缺口**是逃生口——站到它下面才不会被压扁。
- 柱子上的**宝石 / 护盾 / 减速**能帮你，但别太晚离开安全缺口。
- 连续存活叠加**连击**（更高分 + 星星）；提前就位、连击 ≥3 各额外 +1 星。
- 撑过全部 8 间密室 = 逃出生天。

## 语言

- 默认 **英文**；右上角 / 暂停屏下拉可切 **中文**。
- `?lang=zh` 可覆盖；选择写入 localStorage，刷新保留。

## 门禁

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
index.html          入口
styles.css          样式
config/             配置与文案（design.json = 机器可读设计源）
src/core/           i18n、SDK、音频
src/game/           纯逻辑（sim）
src/render/         Canvas 霓虹渲染
src/ui/             DOM 层
src/vendor/         pipysdk（vendored，本地降级）
tests/              测试
tools/              自对弈 / 音频验收 / 验收计划
```

## 调试契约

`window.__ll` 暴露：`state.phase` / `state.lang`、`start` / `pause` / `resume` / `restart` / `home`、
`run`、`tutorial`（`active` / `step` / `steps` / `skip`）、`startTutorial`、`debug.autoSurvive` 等。
