# BOUNCY BALL RUN3D

> 弹球跑酷3D · 霓虹螺旋坠落

3D 螺旋塔跳球：左右旋转霓虹高塔，让弹球穿过缺口一路下坠，躲红块、吃宝石，冲击第 30 层通关。玩法骨架 1:1 还原《欢乐球球》（螺旋塔弹球），主题换皮为霓虹街机。

## 运行

```bash
cd games/bouncy-ball-run3d
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 手势 |
| --- | --- |
| 旋转高塔 | 拖拽左右 / ← → |
| 暂停 | Esc |
| 重开 | R |

## 语言

- 默认英文；标题右上角 / 暂停屏可切中文。
- `?lang=zh` 可临时覆盖；选择写入 localStorage，刷新后保留。

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

## 目录

```
index.html          入口
styles.css          样式
config/             配置与文案（design.json = 机器可读设计源）
src/core/           i18n / 存档 / SDK / 程序化音频
src/game/sim.js     纯逻辑（Node 可测）
src/render/         Canvas 伪 3D 渲染
src/ui/             DOM UI
src/main.js         主入口（60Hz + 调试契约）
tests/              测试
tools/              自对弈 / 音频验收 / verify 计划
```

## 调试契约

`window.__ll` 暴露：`state.phase`、`start/pause/resume/restart`、`run`、`tutorial{active,step,steps}`、`startTutorial()`、`debug.seed/greedy/forceWin/forceLose`。
