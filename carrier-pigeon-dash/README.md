# CARRIER PIGEON DASH

> 信鸽速递 · 霓虹街机飞躲

## 运行

```bash
cd carrier-pigeon-dash
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触摸 |
| --- | --- |
| 振翅 | 空格 / ↑ / W / 点按 |
| 暂停 | Esc / P |
| 重开 | R |
| 静音 | M |

## 语言

- 默认 **英文**；标题右上角 / 暂停屏可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage（`carrier-pigeon-dash-lang`）。

## 测试与验收

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts/tutorial
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 目录

```
index.html          入口
styles.css          样式
config/             配置与文案（design.json = 机器可读设计源）
src/core/           i18n / 存档 / SDK / 音频
src/game/sim.js     纯逻辑（可测，无 DOM）
src/render/         canvas 程序化渲染
src/ui/             DOM UI
src/vendor/         vendored pipysdk（本地降级）
tests/              测试
tools/              自对弈 / 验收计划 / 音频验收 / 海报
```

## 调试契约

`window.__ll` 暴露：`state.phase/lang`、`start/pause/resume/restart`、`run`、
`tutorial {active,step,steps,current,skip}`、`startTutorial`、`debug.pose/poseRock/die/setTutorialDone`。
