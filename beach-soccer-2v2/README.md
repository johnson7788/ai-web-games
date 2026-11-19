# BEACH SOCCER 2V2

> 沙滩足球 2V2 · 霓虹沙滩技巧射门

## 运行

```bash
cd beach-soccer-2v2
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 手势 |
| --- | --- |
| 瞄准 | 在球上拖拽（桌面：按住拖） |
| 踢球 | 松手（或释放鼠标/手指） |
| 暂停 | Esc / P |
| 重开 | R |
| 静音 | M |

## 玩法

- 拖拽球瞄准，松手踢出；球受重力与弹力垫反弹。
- 沿途吃星（3 秒内连吃触发连击）、吃能量球（下一次踢球 ×2）。
- 落入球门得分；每关踢球次数有限，用完未进球判负。
- 完赛越快，额外时间星越多；星级与总分写入最佳纪录。

## 语言

- 默认 **英文**；标题右上角下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage。

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
index.html / styles.css     入口与样式
config/                     数值 / 关卡 / 文案 / 设计源 / SDK 配置
src/core/                   i18n、SDK、程序化音频
src/game/sim.js             纯逻辑（物理 / 状态机 / 事件）
src/render/index.js         canvas 程序化霓虹沙滩
src/ui/ui.js                DOM UI
src/main.js                 装配与调试契约
tools/                      verify.plan / selfplay / audio-check / finalshots
```

## 调试契约

`window.__ll` 暴露 `{ state:{phase,lang}, start, pause, resume, restart, run, tutorial:{active,step,steps}, startTutorial }`。
